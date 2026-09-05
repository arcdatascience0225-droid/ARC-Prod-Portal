import uuid

from azure.storage.blob import BlobServiceClient, ContentSettings

from app.core.config import settings


class BlobStorageService:
    def __init__(self):
        self._client = None
        if settings.AZURE_STORAGE_CONNECTION_STRING:
            self._client = BlobServiceClient.from_connection_string(
                settings.AZURE_STORAGE_CONNECTION_STRING
            )

    def upload_recording(self, file_bytes: bytes, content_type: str, extension: str) -> str:
        """Uploads a mock-interview recording and returns its blob URL.
        Actual audio/video capture is optional per spec - this just defines
        the storage contract used once recordings are wired up."""
        if not self._client:
            raise RuntimeError("Azure Blob Storage is not configured (AZURE_STORAGE_CONNECTION_STRING missing)")

        container = settings.AZURE_STORAGE_CONTAINER_RECORDINGS
        blob_name = f"{uuid.uuid4()}.{extension}"
        container_client = self._client.get_container_client(container)
        container_client.upload_blob(
            name=blob_name, data=file_bytes,
            content_settings=ContentSettings(content_type=content_type),
        )
        return f"{container_client.url}/{blob_name}"

    def upload_report(self, file_bytes: bytes, filename: str, content_type: str) -> str:
        if not self._client:
            raise RuntimeError("Azure Blob Storage is not configured (AZURE_STORAGE_CONNECTION_STRING missing)")

        container = settings.AZURE_STORAGE_CONTAINER_REPORTS
        container_client = self._client.get_container_client(container)
        container_client.upload_blob(
            name=filename, data=file_bytes,
            content_settings=ContentSettings(content_type=content_type),
            overwrite=True,
        )
        return f"{container_client.url}/{filename}"
