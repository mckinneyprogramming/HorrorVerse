export async function shareStoryImage(blob: Blob, filename: string): Promise<"shared" | "saved"> {
  const file = new File([blob], filename, { type: blob.type || "image/png" });
  if (canShareFiles(file)) {
    try {
      await navigator.share({
        files: [file],
        title: "HorrorVerse",
        text: "From the HorrorVerse",
      });
      return "shared";
    } catch (error) {
      if (isAbort(error)) {
        return "shared";
      }
    }
  }

  downloadBlob(blob, filename);
  return "saved";
}

function canShareFiles(file: File): boolean {
  return typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
}

function isAbort(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && String((error as { name: unknown }).name) === "AbortError";
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
