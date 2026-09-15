// PDF renderer for /api/export.
// Follows the Sovereign design brief (§10): serif display + sans body, no
// borders that look like boxes, hairlines only, generated_at + corpus_version
// on every page footer.

import PDFDocument from "pdfkit";
import type { FeasibilityResponse, Obligation, ResolveResponse, SchemesResponse } from "@/types/api";
import { CORPUS_VERSION } from "@/lib/env";

export interface ExportInputs {
  resolve: ResolveResponse;
  feasibility: FeasibilityResponse | null;
  schemes: SchemesResponse | null;
  business_label: string;
  profile: {
    city?: string | null;
    entity_type?: string | null;
    turnover_inr?: number | null;
    employees?: number | null;
    budget_inr?: number | null;
  };
}

export async function renderPdf(inputs: ExportInputs): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 54, info: { Title: "NAVEXA pathway" } });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Register the footer stamp on every new page. See §9: judges notice provenance.
    doc.on("pageAdded", () => stampFooter(doc, inputs.resolve.generated_at));
    stampFooter(doc, inputs.resolve.generated_at);

    // -- header ---------------------------------------------------------------
    doc.font("Helvetica-Bold").fontSize(11).text("NAVEXA", { continued: true });
    doc.font("Helvetica").fontSize(10).fillColor("#4a4744").text("   Tamil Nadu", { align: "left" });
    doc.moveDown(1.5);

    doc.font("Times-Roman").fontSize(20).fillColor("#12100e").text(inputs.business_label);
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(10).fillColor("#4a4744").text(
      [
        inputs.profile.city,
        inputs.profile.entity_type,
        inputs.profile.turnover_inr ? `~₹${inputs.profile.turnover_inr.toLocaleString("en-IN")} turnover` : null,
        inputs.profile.employees ? `${inputs.profile.employees} staff` : null,
        inputs.profile.budget_inr ? `₹${inputs.profile.budget_inr.toLocaleString("en-IN")} budget` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    );

    hr(doc);

    // -- pathway --------------------------------------------------------------
    sectionHeading(doc, "Pathway");
    renderPathway(doc, inputs.resolve.obligations);

    // -- funding --------------------------------------------------------------
    if (inputs.schemes && inputs.schemes.schemes.length > 0) {
      hr(doc);
      sectionHeading(doc, "Funding");
      renderFunding(doc, inputs.schemes);
    }

    // -- feasibility ----------------------------------------------------------
    if (inputs.feasibility && inputs.feasibility.available) {
      hr(doc);
      sectionHeading(doc, "Feasibility");
      renderFeasibility(doc, inputs.feasibility);
    }

    // -- calendar hint --------------------------------------------------------
    hr(doc);
    sectionHeading(doc, "Ongoing compliance");
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#4a4744")
      .text(
        "Every obligation with a renewal cycle above is repeated on the compliance calendar in the app. Confirm each date with the issuing authority before relying on it."
      );

    doc.moveDown(1);
    doc
      .font("Helvetica-Oblique")
      .fontSize(9)
      .fillColor("#4a4744")
      .text("Not legal advice.");

    doc.end();
  });
}

function stampFooter(doc: PDFKit.PDFDocument, generatedAt: string) {
  const y = doc.page.height - 36;
  doc.save();
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#4a4744")
    .text(
      `Generated ${new Date(generatedAt).toLocaleString("en-IN")} · Corpus ${CORPUS_VERSION} · Not legal advice.`,
      54,
      y,
      { width: doc.page.width - 108, align: "center" }
    );
  doc.restore();
}

function hr(doc: PDFKit.PDFDocument) {
  doc.moveDown(0.6);
  const y = doc.y;
  doc.strokeColor("#dedad2").lineWidth(0.5).moveTo(54, y).lineTo(doc.page.width - 54, y).stroke();
  doc.moveDown(0.6);
}

function sectionHeading(doc: PDFKit.PDFDocument, label: string) {
  doc.font("Times-Roman").fontSize(14).fillColor("#12100e").text(label);
  doc.moveDown(0.4);
}

function renderPathway(doc: PDFKit.PDFDocument, obligations: Obligation[]) {
  const grouped: Record<string, Obligation[]> = { "pre-launch": [], "at-launch": [], ongoing: [] };
  for (const o of obligations) grouped[o.phase].push(o);

  const phaseLabel = { "pre-launch": "Before you start", "at-launch": "At launch", ongoing: "Ongoing" };
  let n = 0;
  for (const phase of ["pre-launch", "at-launch", "ongoing"] as const) {
    const items = grouped[phase];
    if (items.length === 0) continue;
    doc.font("Helvetica").fontSize(9).fillColor("#4a4744").text(phaseLabel[phase]);
    doc.moveDown(0.3);
    for (const o of items) {
      n++;
      doc.font("Times-Roman").fontSize(11).fillColor("#12100e").text(`${n}. ${o.name}`);
      if (o.reason) {
        doc.font("Helvetica").fontSize(9).fillColor("#4a4744").text(o.reason);
      }
      const feeLabel =
        o.fee_inr === 0
          ? "Free"
          : o.fee_inr === null || o.fee_inr === undefined
            ? "Confirm with authority"
            : `₹${o.fee_inr.toLocaleString("en-IN")}`;
      const timeline = o.timeline_days ? `${o.timeline_days[0]}–${o.timeline_days[1]} days` : "";
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#4a4744")
        .text([feeLabel, timeline].filter(Boolean).join(" · "));
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#4a4744")
        .text(
          `Source: ${o.citation.locator}${o.citation.verified_on ? ` · verified ${o.citation.verified_on}` : " · ⚠ confirm with authority"}`
        );
      doc.moveDown(0.5);
    }
    doc.moveDown(0.4);
  }
}

function renderFunding(doc: PDFKit.PDFDocument, schemes: SchemesResponse) {
  for (const s of schemes.schemes) {
    doc.font("Times-Roman").fontSize(11).fillColor("#12100e").text(s.name);
    doc.font("Helvetica").fontSize(9).fillColor("#4a4744").text(s.summary);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#4a4744")
      .text(
        s.criteria
          .map((c) => `${c.status === "met" ? "✓" : c.status === "unmet" ? "✗" : "?"} ${c.label}`)
          .join("   ")
      );
    doc.moveDown(0.5);
  }
}

function renderFeasibility(doc: PDFKit.PDFDocument, f: FeasibilityResponse) {
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#12100e").text("One-time");
  for (const l of f.capex) {
    doc.font("Helvetica").fontSize(10).fillColor("#4a4744").text(`${l.label} — ₹${l.value_inr.toLocaleString("en-IN")}`);
  }
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#12100e").text(`Setup total — ₹${f.capex_total_inr.toLocaleString("en-IN")}`);

  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#12100e").text("Monthly");
  for (const l of f.opex) {
    doc.font("Helvetica").fontSize(10).fillColor("#4a4744").text(`${l.label} — ₹${l.value_inr.toLocaleString("en-IN")}`);
  }
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#12100e").text(`Monthly total — ₹${f.opex_monthly_inr.toLocaleString("en-IN")}`);

  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#a67c00").text(
    `Verdict: ${f.verdict.replace(/_/g, " ")} · runway ${f.runway_months.toFixed(1)} months`
  );

  if (f.assumptions.length > 0) {
    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(9).fillColor("#4a4744").text("Assumptions: " + f.assumptions.join(" "));
  }
}
