import React from 'react';
import { AssessmentReport } from './apps/web/src/lib/pdf/templates/assessmentReport.tsx';
import { renderReactToPdfStream } from './apps/web/src/lib/pdf/pdfRenderer.tsx';

async function run() {
  const mockData = {
    organizationName: "Test Org",
    reportDate: "2026-07-30",
    overallScore: 45,
    riskLevel: "High Risk",
    categories: Array.from({ length: 5 }).map((_, i) => ({
      name: `Category ${i}`,
      score: 50,
      risk: "Moderate Risk"
    })),
    findings: Array.from({ length: 5 }).map((_, i) => ({
      categoryName: `Category ${i}`,
      items: Array.from({ length: 4 }).map((_, j) => ({
        question: `This is a test question for category ${i} item ${j}?`,
        answer: "Yes, this is a very long answer that might wrap across multiple lines to test the layout engine.",
        riskScore: 20,
        risk: "High Risk"
      }))
    })),
    actionItems: Array.from({ length: 10 }).map((_, i) => ({
      title: `Action Item ${i}`,
      description: "Description of the action item.",
      severity: "High",
      article: "Art 32"
    }))
  };

  console.time('renderReactToPdfStream');
  const element = React.createElement(AssessmentReport, { data: mockData as any });
  const stream = await renderReactToPdfStream(element);
  console.timeEnd('renderReactToPdfStream');

  console.time('stream consumption');
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
  }
  console.timeEnd('stream consumption');
  console.log('PDF Size:', size);
}

run().catch(console.error);


