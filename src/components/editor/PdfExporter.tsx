"use client";

export class PdfExporter {
  static async exportToPdf(htmlContent: string, title: string = "document") {
    if (!htmlContent) return;
    
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const element = document.createElement("div");
      element.innerHTML = htmlContent;
      element.style.width = "794px";
      element.style.margin = "0 auto";
      element.style.background = "#ffffff";
      document.body.appendChild(element);
      
      const scale = Math.max(2, Math.ceil((window.devicePixelRatio || 1) * 2));
      await html2pdf()
        .from(element)
        .set({
          margin: 0,
          filename: `${title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale,
            useCORS: true,
            scrollX: 0,
            scrollY: 0,
            backgroundColor: "#ffffff",
          },
          jsPDF: {
            unit: "mm",
            format: "a4",
            orientation: "portrait",
            compress: true,
          },
          pagebreak: { mode: ["css", "avoid-all"] },
        })
        .save();
      element.remove();
    } catch (error) {
      console.error("Error exporting PDF:", error);
    }
  }
}
