import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import JobsPage from "./hr/JobsPage";
import CandidateMatchPage from "./hr/CandidateMatchPage";
import ConductInterviewPage from "./interview/ConductInterviewPage";

export function JobsPageRoute() {
  const navigate = useNavigate();
  return <JobsPage onViewJob={(jobId: string) => navigate(`/hr/candidate-match/${jobId}`)} />;
}

export function CandidateMatchPageRoute() {
  const { jobId } = useParams<{ jobId: string }>();
  if (!jobId) return null;
  return <CandidateMatchPage jobId={jobId} />;
}

export function ConductInterviewPageRoute() {
  const { interviewId } = useParams<{ interviewId: string }>();
  if (!interviewId) return null;
  return <ConductInterviewPage interviewId={interviewId} />;
}
