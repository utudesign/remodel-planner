import { describe, expect, it } from "vitest";
import { classifyFile, DOC_ACCEPT, tagForRequirementFolder } from "@/lib/files/types";

describe("classifyFile (v3 item 8: Files = PDF/Word, Photos = images)", () => {
  it("takes PDF and Word with matching extensions", () => {
    expect(classifyFile("contract.pdf", "application/pdf")).toEqual({ kind: "doc", mime: "application/pdf" });
    expect(classifyFile("old.DOC", "application/msword").kind).toBe("doc");
    expect(
      classifyFile("plan.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document").kind,
    ).toBe("doc");
  });

  it("lets the extension decide when the phone sends no type or octet-stream", () => {
    expect(classifyFile("plan.docx", "").mime).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(classifyFile("plan.pdf", "application/octet-stream").kind).toBe("doc");
    expect(classifyFile("IMG_0001.HEIC", "")).toEqual({ kind: "photo", mime: "image/heic" });
  });

  it("files images as photos", () => {
    expect(classifyFile("IMG_0001.jpg", "image/jpeg").kind).toBe("photo");
    expect(classifyFile("sketch.png", "image/png").kind).toBe("photo");
  });

  it("refuses everything else, and a type that disagrees with the extension", () => {
    expect(classifyFile("budget.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").kind).toBe("bad");
    expect(classifyFile("notes.txt", "text/plain").kind).toBe("bad");
    expect(classifyFile("fake.pdf", "application/msword").kind).toBe("bad");
    expect(classifyFile("noext", "").kind).toBe("bad");
  });

  it("accept list names exactly the three document types", () => {
    expect(DOC_ACCEPT).toContain(".pdf");
    expect(DOC_ACCEPT).toContain(".docx");
    expect(DOC_ACCEPT).not.toContain("image");
    expect(DOC_ACCEPT).not.toContain("xls");
  });

  it("tags checklist images by the item's folder", () => {
    expect(tagForRequirementFolder("design")).toBe("sketch");
    expect(tagForRequirementFolder("other")).toBe("appliance_label");
    expect(tagForRequirementFolder("photos")).toBe("other");
  });
});
