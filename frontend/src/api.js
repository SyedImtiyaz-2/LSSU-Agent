import axios from "axios";

const api = axios.create({ baseURL: "/api" });

// Attach auth token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auth
export async function login(email, password) {
  const { data } = await api.post("/auth/login", { email, password });
  localStorage.setItem("token", data.access_token);
  localStorage.setItem("user", JSON.stringify(data));
  return data;
}

export async function signup(email, password) {
  const { data } = await api.post("/auth/signup", { email, password });
  localStorage.setItem("token", data.access_token);
  localStorage.setItem("user", JSON.stringify(data));
  return data;
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function getUser() {
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}

export function isAuthenticated() {
  return !!localStorage.getItem("token");
}

// Interviews
export async function createInterview() {
  const { data } = await api.post("/interviews");
  return data;
}

export async function getInterview(id) {
  const { data } = await api.get(`/interviews/${id}`);
  return data;
}

export async function listInterviews() {
  const { data } = await api.get("/interviews");
  return data.interviews;
}

// LiveKit
export async function getLivekitToken(room, identity) {
  const { data } = await api.get("/token", { params: { room, identity } });
  return data;
}

// Documents
export async function uploadDocument(file) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/documents/upload", form);
  return data;
}

export async function listDocuments() {
  const { data } = await api.get("/documents");
  return data.documents;
}

export async function deleteDocument(id) {
  const { data } = await api.delete(`/documents/${id}`);
  return data;
}

// Reports
export async function generateReport(interviewId) {
  const { data } = await api.post(`/reports/${interviewId}/generate`);
  return data;
}

export function getReportDownloadUrl(interviewId) {
  return `/api/reports/${interviewId}/download`;
}

// Invitations
export async function sendInvitations(emails, message = "") {
  const { data } = await api.post("/invitations/send", { emails, message });
  return data;
}

export async function listInvitations() {
  const { data } = await api.get("/invitations");
  return data.invitations;
}

export async function getInvitation(token) {
  const { data } = await api.get(`/invitations/${token}`);
  return data;
}

export async function startInviteSession(token, name = "") {
  const { data } = await api.post(`/invitations/${token}/start`, { name });
  return data;
}
