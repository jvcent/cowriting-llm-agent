"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useFlow } from "@/context/FlowContext";

export default function SoloPage() {
  const router = useRouter();
  const { addSoloEssay } = useFlow();

  // Final answer text
  const [finalAnswer, setFinalAnswer] = useState("");

  // Timer state
  const timerDuration = 300;
  const [timeLeft, setTimeLeft] = useState(timerDuration);
  const roundEndedRef = useRef(false);
  const startTimeRef = useRef(Date.now());

  // Question tracking
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [usedQuestionIndices, setUsedQuestionIndices] = useState<number[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);

  // Questions state
  const [allQuestions, setAllQuestions] = useState<string[]>([]);
  const [loadedQuestions, setLoadedQuestions] = useState(false);

  // Load questions from JSON
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await fetch("/questions.json");
        if (!response.ok) throw new Error("Failed to fetch questions");
        const data = await response.json();
        const questions: string[] = Object.values(data).flat() as string[];
        const shuffled = questions.sort(() => 0.5 - Math.random());
        setAllQuestions(shuffled.slice(0, 2));
      } catch (error) {
        console.error("Error loading questions:", error);
        setAllQuestions([
          "In how many ways can four couples be seated at a round table if the men and women want to sit alternately?",
          "In how many different ways can five people be seated at a circular table?",
        ]);
      } finally {
        setLoadedQuestions(true);
      }
    };
    fetchQuestions();
  }, []);

  // Format seconds → MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Start or restart a question round
  const startNewRound = useCallback(() => {
    if (!loadedQuestions) {
      setTimeout(startNewRound, 500);
      return;
    }
    if (usedQuestionIndices.length >= allQuestions.length) {
      router.push("/completed");
      return;
    }

    setFinalAnswer("");
    const newIndex = usedQuestionIndices.length;
    setCurrentQuestionIndex(newIndex);
    setUsedQuestionIndices((prev) => [...prev, newIndex]);
    setCurrentQuestion(allQuestions[newIndex]);

    setTimeLeft(timerDuration);
    roundEndedRef.current = false;
    startTimeRef.current = Date.now();
  }, [loadedQuestions, usedQuestionIndices.length, allQuestions, router]);

  // Initialize first question when loaded
  useEffect(() => {
    if (loadedQuestions) {
      startNewRound();
    }
  }, [loadedQuestions, startNewRound]);

  // Proceed to next question
  const handleNextQuestion = useCallback(() => {
    if (currentQuestion && finalAnswer.trim()) {
      const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);
      addSoloEssay({
        questionType: currentQuestionIndex === 0 ? "creative" : "argumentative",
        question: currentQuestion,
        essay: finalAnswer,
        timeSpent,
      });
    }
    startNewRound();
  }, [
    currentQuestion,
    finalAnswer,
    currentQuestionIndex,
    addSoloEssay,
    startNewRound,
  ]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) {
      handleNextQuestion();
      return;
    }
    if (roundEndedRef.current) return;

    const timerId = setTimeout(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timerId);
  }, [timeLeft, handleNextQuestion]);

  return (
    <div className="h-screen bg-gradient-to-b from-[#2D0278] to-[#0A001D] p-4 flex flex-row overflow-hidden">
      <div className="w-full pr-2 flex flex-col h-full overflow-hidden">
        {/* Writing Prompt + Timer */}
        {currentQuestion && (
          <div className="bg-white bg-opacity-20 p-4 rounded-md mb-4 border-2 border-purple-400">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-xl text-white font-semibold">
                Writing Prompt:
              </h2>
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

        {/* Essay Input */}
        <div className="flex flex-col bg-white bg-opacity-15 rounded-md p-4 mb-4 h-full border-2 border-blue-400 shadow-lg">
          <h3 className="text-xl text-white font-semibold mb-2">Your Essay</h3>
          <textarea
            value={finalAnswer}
            onChange={(e) => setFinalAnswer(e.target.value)}
            placeholder="Enter your response here..."
            className="w-full grow bg-white bg-opacity-10 text-white border border-gray-600 rounded-md px-3 py-3 text-lg"
          />
        </div>
      </div>
    </div>
  );
}
