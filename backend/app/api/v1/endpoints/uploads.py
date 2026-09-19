from fastapi import APIRouter, Depends, UploadFile, File, HTTPException

from app.core.deps import CurrentUser, get_current_user
from app.services.blob_storage_service import BlobStorageService

router = APIRouter(prefix="/uploads", tags=["Uploads"])

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

# Assignment submissions, chat images/voice/files — allowlist rather than
# blocklist, so nothing executable or script-bearing (.html, .svg, .exe,
# .php, etc.) can be uploaded and later served back to another user.
ALLOWED_CONTENT_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "audio/webm", "audio/mpeg", "audio/wav", "audio/ogg",
    "application/pdf",
    "application/zip", "application/x-zip-compressed",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain", "text/csv",
    "application/octet-stream",  # some browsers send this for .ipynb/.py — filename extension is checked too
}
ALLOWED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp",
    ".webm", ".mp3", ".wav", ".ogg",
    ".pdf", ".zip", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx",
    ".txt", ".csv", ".py", ".ipynb",
}


@router.post("/file", summary="Upload a file (assignment attachment/submission, chat attachment) — returns its URL")
async def upload_file(
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
):
    filename = file.filename or "upload"
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS or (file.content_type and file.content_type not in ALLOWED_CONTENT_TYPES):
        raise HTTPException(status_code=415, detail="This file type isn't allowed.")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 20 MB)")

    try:
        url = BlobStorageService().upload_file(
            contents, filename, file.content_type or "application/octet-stream"
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    return {"url": url, "filename": filename, "contentType": file.content_type}
