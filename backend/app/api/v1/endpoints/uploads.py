from fastapi import APIRouter, Depends, UploadFile, File, HTTPException

from app.core.deps import CurrentUser, get_current_user
from app.services.blob_storage_service import BlobStorageService

router = APIRouter(prefix="/uploads", tags=["Uploads"])

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


@router.post("/file", summary="Upload a file (assignment attachment/submission, chat attachment) — returns its URL")
async def upload_file(
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
):
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 20 MB)")

    try:
        url = BlobStorageService().upload_file(
            contents, file.filename or "upload", file.content_type or "application/octet-stream"
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    return {"url": url, "filename": file.filename, "contentType": file.content_type}
