"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Define test questions structure
interface TestQuestion {
  id: number;
  question: string;
}

export default function TestPage() {
  const router = useRouter();

  // Answer state
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Timer state
  const timerDuration = 120;
  const [timeLeft, setTimeLeft] = useState(timerDuration);
  const roundEndedRef = useRef(false);

  // Question tracking
  const [usedQuestionIndices, setUsedQuestionIndices] = useState<number[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<TestQuestion | null>(
    null
  );
  const [allQuestions, setAllQuestions] = useState<TestQuestion[]>([]);
  const [loadedQuestions, setLoadedQuestions] = useState(false);

  // Format time MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Load questions
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const response = await fetch("/test-questions.json");
        const data = await response.json();
        const questions: TestQuestion[] = data.questions || [];
        const shuffled = questions.sort(() => 0.5 - Math.random());
        setAllQuestions(shuffled.slice(0, 2));
      } catch (error) {
        console.error("Error loading questions:", error);
        setAllQuestions([
          {
            id: 1,
            question:
              "Describe how the development of social media has impacted modern communication.",
          },
          {
            id: 2,
            question:
              "Explain the importance of environmental conservation in today's world.",
          },
        ]);
      } finally {
        setLoadedQuestions(true);
        setIsLoading(false);
      }
    };
    loadQuestions();
  }, []);

  // Start or advance round
  const startNewRound = () => {
    if (!loadedQuestions) {
      setTimeout(startNewRound, 500);
      return;
    }
    if (usedQuestionIndices.length >= allQuestions.length) {
      router.push("/");
      return;
    }

    setCurrentAnswer("");
    const newIndex = usedQuestionIndices.length;
    setUsedQuestionIndices((prev) => [...prev, newIndex]);
    setCurrentQuestion(allQuestions[newIndex]);

    setTimeLeft(timerDuration);
    roundEndedRef.current = false;
  };

  // Initialize on load
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (loadedQuestions) {
      startNewRound();
    }
  }, [loadedQuestions]);

  // Advance when time's up
  const handleNextQuestion = () => {
    startNewRound();
  };

  // Timer effect
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }, [timeLeft]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen justify-center items-center bg-gray-900 text-white">
        <div className="text-2xl">Loading questions...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-b from-[#2D0278] to-[#0A001D] p-4 flex flex-col overflow-hidden">
      {currentQuestion && (
        <div className="bg-white bg-opacity-20 p-4 rounded-md mb-4 border-2 border-purple-400">
          <div className="flex justify-between items-start mb-2">
            <h2 className="text-xl text-white font-semibold">Writing Prompt:</h2>
            <div
              className={`p-2 rounded-lg ${
                timeLeft > 60
                  ? "bg-green-700"
                  : timeLeft > 30
                  ? "bg-yellow-600 animate-pulse"
                  : "bg-red-700 animate-pulse"
              } ml-4`}
            >
              <div className="text-xl font-mono text-white">{formatTime(timeLeft)}</div>
              {timeLeft <= 60 && (
                <div className="text-xs text-white text-center">
                  {timeLeft <= 30 ? "Time almost up!" : "Finish soon!"}
                </div>
              )}
            </div>
          </div>
          <p className="text-white text-lg">{currentQuestion.question}</p>
        </div>
      )}

      <div className="flex flex-col bg-white bg-opacity-15 rounded-md p-4 mb-4 h-full border-2 border-blue-400 shadow-lg">
        <h3 className="text-xl text-white font-semibold mb-2">Your Essay</h3>
        <textarea
          value={currentAnswer}
          onChange={(e) => setCurrentAnswer(e.target.value)}
          placeholder="Enter your response here..."
          className="w-full grow bg-white bg-opacity-10 text-white border border-gray-600 rounded-md px-3 py-3 text-lg"
        />
      </div>
    </div>
  );
}
