"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { Message } from "@/utils/types";

type QuestionType = "creative" | "argumentative";

interface EssayData {
  questionType: QuestionType;
  question: string;
  essay: string;
  chatLog?: Message[];
  timeSpent: number;
  assignedAgentId?: string;
  assignedAgentName?: string;
}

interface SurveyAnswers {
  confidence: string;
  inputHelpfulness: string;
  ideaPrompting: string;
  overwhelmed: string;
  writingPromptsCount?: string | number;
}

interface FlowContextType {
  // Essay data from each page
  soloEssays: EssayData[];
  singleEssays: EssayData[];
  groupEssays: EssayData[];

  // Survey data
  surveyAnswers: SurveyAnswers | null;

  // MTurk data
  assignmentId: string | null;
  hitId: string | null;
  turkSubmitTo: string | null;
  workerId: string | null;

  // Methods to update state
  addSoloEssay: (data: EssayData) => void;
  addSingleEssay: (data: EssayData) => void;
  addGroupEssay: (data: EssayData) => void;
  saveSurveyData: (data: SurveyAnswers) => void;
  saveMTurkData: (data: {
    assignmentId: string;
    hitId: string;
    turkSubmitTo: string;
    workerId: string;
  }) => void;

  // Method to submit all data
  submitAllDataToDatabase: () => Promise<void>;
}

const FlowContext = createContext<FlowContextType | undefined>(undefined);

export function FlowProvider({ children }: { children: ReactNode }) {
  // State for essays from each page type
  const [soloEssays, setSoloEssays] = useState<EssayData[]>([]);
  const [singleEssays, setSingleEssays] = useState<EssayData[]>([]);
  const [groupEssays, setGroupEssays] = useState<EssayData[]>([]);

  // State for survey answers
  const [surveyAnswers, setSurveyAnswers] = useState<SurveyAnswers | null>(
    null,
  );

  // State for MTurk data
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [hitId, setHitId] = useState<string | null>(null);
  const [turkSubmitTo, setTurkSubmitTo] = useState<string | null>(null);
  const [workerId, setWorkerId] = useState<string | null>(null);

  // Methods to add essays
  const addSoloEssay = (data: EssayData) => {
    setSoloEssays((prev) => [...prev, data]);
  };

  const addSingleEssay = (data: EssayData) => {
    setSingleEssays((prev) => [...prev, data]);
  };

  const addGroupEssay = (data: EssayData) => {
    setGroupEssays((prev) => [...prev, data]);
  };

  // Method to save survey data
  const saveSurveyData = (data: SurveyAnswers) => {
    setSurveyAnswers(data);
  };

  // Method to save MTurk data
  const saveMTurkData = (data: {
    assignmentId: string;
    hitId: string;
    turkSubmitTo: string;
    workerId: string;
  }) => {
    setAssignmentId(data.assignmentId);
    setHitId(data.hitId);
    setTurkSubmitTo(data.turkSubmitTo);
    setWorkerId(data.workerId);
  };

  // Method to submit all data to database
  const submitAllDataToDatabase = async () => {
    const allData = {
      soloEssays,
      singleEssays,
      groupEssays,
      surveyAnswers,
      mturk: {
        assignmentId,
        hitId,
        turkSubmitTo,
        workerId,
      },
    };

    try {
      // Replace with your actual API endpoint
      const response = await fetch("/api/submit-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(allData),
      });

      if (!response.ok) {
        throw new Error("Failed to submit data");
      }

      // Optional: Clear state after successful submission
      setSoloEssays([]);
      setSingleEssays([]);
      setGroupEssays([]);
      setSurveyAnswers(null);
      setAssignmentId(null);
      setHitId(null);
      setTurkSubmitTo(null);
      setWorkerId(null);
    } catch (error) {
      console.error("Error submitting data:", error);
      throw error;
    }
  };

  return (
    <FlowContext.Provider
      value={{
        soloEssays,
        singleEssays,
        groupEssays,
        surveyAnswers,
        assignmentId,
        hitId,
        turkSubmitTo,
        workerId,
        addSoloEssay,
        addSingleEssay,
        addGroupEssay,
        saveSurveyData,
        saveMTurkData,
        submitAllDataToDatabase,
      }}
    >
      {children}
    </FlowContext.Provider>
  );
}

export function useFlow() {
  const context = useContext(FlowContext);
  if (context === undefined) {
    throw new Error("useFlow must be used within a FlowProvider");
  }
  return context;
}
