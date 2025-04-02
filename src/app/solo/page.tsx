"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function SoloPage() {
  const router = useRouter();

  // Simplified state management
  const [scratchboardContent, setScratchboardContent] = useState("");
  const [finalAnswer, setFinalAnswer] = useState("");
  const [evaluationComplete, setEvaluationComplete] = useState(false);

  // Timer state
  const timerDuration = 300;
  const [timeLeft, setTimeLeft] = useState(timerDuration);
  const roundEndedRef = useRef(false);

  // Question tracking
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [usedQuestionIndices, setUsedQuestionIndices] = useState<number[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);

  // Questions state
  const [allQuestions, setAllQuestions] = useState<string[]>([]);
  const [loadedQuestions, setLoadedQuestions] = useState(false);

  // Load questions from JSON file
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await fetch("/questions.json");
        if (!response.ok) {
          throw new Error("Failed to fetch questions");
        }

        const data = await response.json();
        const questions: string[] = Object.values(data).flat() as string[];
        // Only take 2 random questions from the pool
        const shuffled = questions.sort(() => 0.5 - Math.random());
        const selectedQuestions = shuffled.slice(0, 2);

        setAllQuestions(selectedQuestions);
        setLoadedQuestions(true);
      } catch (error) {
        console.error("Error loading questions:", error);
        // Use exactly 2 fallback questions
        setAllQuestions([
          "In how many ways can four couples be seated at a round table if the men and women want to sit alternately?",
          "In how many different ways can five people be seated at a circular table?",
        ]);
        setLoadedQuestions(true);
      }
    };

    fetchQuestions();
  }, []);

  // Helper for formatting time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const startNewRound = () => {
    if (!loadedQuestions) {
      console.log("Waiting for questions to load...");
      setTimeout(startNewRound, 500);
      return;
    }

    // Modified to check for exactly 2 questions
    if (usedQuestionIndices.length >= 2) {
      console.log("Both questions completed, redirecting to break screen");
      router.push("/break");
      return;
    }

    // Reset state for new round
    setEvaluationComplete(false);
    setScratchboardContent("");
    setFinalAnswer("");

    // Simplified question selection - just use the next question
    const newIndex = usedQuestionIndices.length;
    setCurrentQuestionIndex(newIndex);
    setUsedQuestionIndices((prev) => [...prev, newIndex]);
    setCurrentQuestion(allQuestions[newIndex]);

    // Reset timer and other state
    setTimeLeft(timerDuration);
    roundEndedRef.current = false;
  };

  // Initialize with first question once questions are loaded
  useEffect(() => {
    if (loadedQuestions) {
      startNewRound();
    }
  }, [loadedQuestions]);

  // Handle next question button
  const handleNextQuestion = () => {
    setEvaluationComplete(false);
    startNewRound();
  };

  // Add the timer useEffect
  useEffect(() => {
    if (timeLeft <= 0) {
      handleNextQuestion();
      return;
    }

    if (roundEndedRef.current) {
      return;
    }

    const timerId = setTimeout(() => {
      setTimeLeft((prevTime) => prevTime - 1);
    }, 1000);

    return () => clearTimeout(timerId);
  }, [timeLeft]);

  return (
    <div className="h-screen bg-gradient-to-b from-[#2D0278] to-[#0A001D] p-4 flex flex-row overflow-hidden">
      {/* LEFT PANEL - Problem, Submission, Scratchboard */}
      <div className="w-full pr-2 flex flex-col h-full overflow-hidden">
        {/* Problem Display with Timer inside */}
        {currentQuestion && (
          <div className="bg-white bg-opacity-20 p-4 rounded-md mb-4 border-2 border-purple-400">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-xl text-white font-semibold">
                Writing Prompt:
              </h2>
              {/* Timer integrated in problem statement */}
              <div
                className={`p-2 rounded-lg ${
                  timeLeft > 20
                    ? "bg-green-700"
                    : timeLeft > 10
                    ? "bg-yellow-600 animate-pulse"
                    : "bg-red-700 animate-pulse"
                } ml-4`}
              >
                <div className="text-xl font-mono text-white">
                  {formatTime(timeLeft)}
                </div>
                {timeLeft <= 20 && (
                  <div className="text-xs text-white text-center">
                    {timeLeft <= 10 ? "Time almost up!" : "Finish soon!"}
                  </div>
                )}
              </div>
            </div>
            <p className="text-white text-lg">{currentQuestion}</p>
          </div>
        )}

        {/* Final Answer */}
        <div className="flex flex-col bg-white bg-opacity-15 rounded-md p-4 mb-4 h-full border-2 border-blue-400 shadow-lg">
          <h3 className="text-xl text-white font-semibold mb-2">Your Essay</h3>
          <div className="flex grow flex-col space-y-3">
            <textarea
              value={finalAnswer}
              onChange={(e) => setFinalAnswer(e.target.value)}
              placeholder="Enter your response here..."
              className="w-full grow bg-white bg-opacity-10 text-white border border-gray-600 rounded-md px-3 py-3 text-lg"
            />
            {/* <button
              onClick={() => handleNextQuestion()}
              disabled={
                !finalAnswer.trim() ||
                !scratchboardContent.trim() ||
                evaluationComplete
              }
              className={`px-4 py-3 rounded-md text-lg font-medium ${
                finalAnswer.trim() &&
                scratchboardContent.trim() &&
                !evaluationComplete
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-gray-700 text-gray-400 cursor-not-allowed"
              }`}
            >
              Next Question
            </button> */}
          </div>
        </div>
      </div>
    </div>
  );
}
