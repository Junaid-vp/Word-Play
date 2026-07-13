export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function getAuthHeaders(isJson = true) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('chat_token') : null;
  const headers: Record<string, string> = {};
  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}
