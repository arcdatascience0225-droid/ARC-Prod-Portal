// Compatibility re-export: the Student Portal module's pages import
// `{ apiClient } from "./client"` with axios-style `.data` responses and
// full "/api/v1/..." paths. Backed by the single canonical axios instance
// (same instance the Foundation/Auth module uses) so tokens/refresh stay
// consistent across the whole app.
import { api } from "../services/api";

export const apiClient = api;
export default api;
