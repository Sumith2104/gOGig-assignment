import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { storageService } from '@/services/storage-service';
import sharp from 'sharp';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const image = await prisma.image.findUnique({
      where: { id },
      include: {
        analysisResults: true,
      },
    });

    if (!image) {
      return NextResponse.json(
        { error: 'Image record not found' },
        { status: 404 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const absPath = storageService.getAbsPath(image.storedPath);

    let aiSummary = '';
    const ocrCheck = image.analysisResults.find(
      (r) => r.checkName === 'ocr_plate_validation'
    );
    const ocrDetails = (ocrCheck?.details as any) || {};
    const campaignBrand = ocrDetails.campaignBrand || 'Unspecified Campaign';
    const plate = ocrDetails.normalizedPlate || 'Unverified Plate';
    const issuesCount = image.analysisResults.filter(
      (r) => r.resultStatus === 'ISSUE_DETECTED' || (!r.passed && r.resultStatus !== 'REVIEW_REQUIRED')
    ).length;

    if (apiKey && apiKey.trim() !== '') {
      try {
        const imageBuffer = await sharp(absPath)
          .resize(1024, 1024, { fit: 'inside' })
          .jpeg({ quality: 85 })
          .toBuffer();

        const base64Image = imageBuffer.toString('base64');
        const promptText = `Act as a senior vehicle ad inspection auditor. Synthesize a concise 2-3 sentence executive audit summary for this image inspection report.
Context:
- Campaign Brand: ${campaignBrand}
- License Plate: ${plate}
- Issues Detected: ${issuesCount} quality/perceptual anomalies logged.

Provide a professional, clear executive summary assessing:
1. Outdoor campaign ad visibility and vehicle license plate clarity.
2. Overall compliance verdict (Approved, Flagged for Review, or Rejected).
Return ONLY the raw summary text without markdown headers.`;

        const candidateModels = [
          'gemini-flash-latest',
          'gemini-3.6-flash',
          'gemini-3.5-flash',
          'gemini-2.5-flash',
        ];

        for (const model of candidateModels) {
          try {
            const res = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [
                    {
                      parts: [
                        { text: promptText },
                        {
                          inlineData: {
                            mimeType: 'image/jpeg',
                            data: base64Image,
                          },
                        },
                      ],
                    },
                  ],
                  generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 250,
                  },
                }),
              }
            );

            if (res.ok) {
              const data = await res.json();
              const text =
                data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
              if (text) {
                aiSummary = text;
                break;
              }
            }
          } catch {
            continue;
          }
        }
      } catch {
        // Fallback to deterministic synthesis if Gemini call fails
      }
    }

    if (!aiSummary) {
      aiSummary = `Executive Audit Summary: Vehicle photo inspected under campaign '${campaignBrand}' with plate '${plate}'. ${image.analysisResults.length} checks executed with ${issuesCount} issue(s) detected. Verification status is COMPLETED.`;
    }

    // Save generated executive summary to DB inside ocr_plate_validation details
    if (ocrCheck) {
      const updatedDetails = {
        ...ocrDetails,
        aiExecutiveSummary: aiSummary,
        aiSummaryGeneratedAt: new Date().toISOString(),
      };

      await prisma.analysisResult.update({
        where: { id: ocrCheck.id },
        data: { details: updatedDetails as any },
      });
    }

    return NextResponse.json({
      success: true,
      aiSummary,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Failed to generate AI executive summary',
      },
      { status: 500 }
    );
  }
}
