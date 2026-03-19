import { Routes, Route, Navigate } from "react-router-dom";
import { isAuthenticated } from "./api";
import LoginPage from "./pages/LoginPage";
import Layout from "./components/Layout";
import DashboardPage from "./pages/DashboardPage";
import InterviewRoom from "./pages/InterviewRoom";
import InterviewsPage from "./pages/InterviewsPage";
import KnowledgeBasePage from "./pages/KnowledgeBasePage";
import ReportsPage from "./pages/ReportsPage";

function ProtectedRoute({ children }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/interviews" element={<InterviewsPage />} />
                <Route path="/interview/:interviewId" element={<InterviewRoom />} />
                <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
                <Route path="/reports" element={<ReportsPage />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
