import uuid
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


def upload_file_to_blob(file_bytes: bytes, original_filename: str, folder: str = "misc") -> str:
    """Uploads a file to Azure Blob Storage and returns its public URL.
    Falls back to a local path reference if Azure is not configured (dev mode).
    """
    ext = original_filename.rsplit(".", 1)[-1] if "." in original_filename else "bin"
    blob_name = f"{folder}/{uuid.uuid4()}.{ext}"

    if not settings.AZURE_STORAGE_CONNECTION_STRING:
        logger.warning("Azure Storage not configured - returning placeholder local URL (dev mode)")
        return f"/local-storage/{blob_name}"

    from azure.storage.blob import BlobServiceClient, ContentSettings

    blob_service_client = BlobServiceClient.from_connection_string(settings.AZURE_STORAGE_CONNECTION_STRING)
    container_client = blob_service_client.get_container_client(settings.AZURE_STORAGE_CONTAINER_NAME)

    try:
        container_client.create_container()
    except Exception:
        pass  # container already exists

    content_type_map = {
        "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
        "pdf": "application/pdf", "doc": "application/msword",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
    content_type = content_type_map.get(ext.lower(), "application/octet-stream")

    blob_client = container_client.get_blob_client(blob_name)
    blob_client.upload_blob(
        file_bytes, overwrite=True, content_settings=ContentSettings(content_type=content_type)
    )
    return blob_client.url
