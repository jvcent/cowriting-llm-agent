"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useFlow } from "@/context/FlowContext";

export default function SoloPage() {
  const router = useRouter();
  const { addSoloEssay } = useFlow();

  /* ──────────────────── state ──────────────────── */
  const [finalAnswer, setFinalAnswer] = useState("");            // essay text
  const timerDuration = 300;                                       // seconds
  const [timeLeft, setTimeLeft] = useState(timerDuration);       // countdown
  const roundEndedRef = useRef(false);                           // flag: time up
  const startTimeRef = useRef(Date.now());                       // for elapsed time

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [usedQuestionIndices, setUsedQuestionIndices] = useState<number[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);

  const [allQuestions, setAllQuestions] = useState<string[]>([]);
  const [loadedQuestions, setLoadedQuestions] = useState(false);

  /* ──────────────────── load questions ──────────────────── */
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const res = await fetch("/questions.json");
        if (!res.ok) throw new Error("Failed to fetch questions");
        const data = await res.json();
        const questions: string[] = Object.values(data).flat() as string[];
        const shuffled = questions.sort(() => 0.5 - Math.random());
        setAllQuestions(shuffled.slice(0, 2));                   // 2‑question demo
      } catch (err) {
        console.error(err);
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

  /* ──────────────────── helpers ──────────────────── */
  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${s % 60 < 10 ? "0" : ""}${s % 60}`;

  /* ──────────────────── round setup ──────────────────── */
  const startNewRound = useCallback(() => {
    if (!loadedQuestions) return;

    // if all questions answered, go to completion page
    if (
      allQuestions.length > 0 &&
      usedQuestionIndices.length >= allQuestions.length
    ) {
      router.push("/completed");
      return;
    }

    setFinalAnswer("");
    setCurrentQuestion(allQuestions[currentQuestionIndex]);
    setTimeLeft(timerDuration);
    roundEndedRef.current = false;               // restart timer
    startTimeRef.current = Date.now();
  }, [loadedQuestions, allQuestions, usedQuestionIndices.length, currentQuestionIndex, router]);

  /* ──────────────────── first question ──────────────────── */
  useEffect(() => {
    if (loadedQuestions && allQuestions.length > 0) startNewRound();
  }, [loadedQuestions, allQuestions, startNewRound]);

  /* ──────────────────── record + advance ──────────────────── */
  const handleNextQuestion = useCallback(
    (force: boolean = false) => {
      if (currentQuestion && (force || finalAnswer.trim())) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        addSoloEssay({
          questionType: currentQuestionIndex === 0 ? "creative" : "argumentative",
          question: currentQuestion,
          essay: finalAnswer || "[No answer provided]",
          timeSpent: elapsed,
        });

        setUsedQuestionIndices((prev) => [...prev, currentQuestionIndex]);
        setCurrentQuestionIndex((prev) => prev + 1);
      }
      startNewRound();
    },
    [currentQuestion, finalAnswer, currentQuestionIndex, addSoloEssay, startNewRound]
  );

  /* ──────────────────── countdown ──────────────────── */
  useEffect(() => {
    if (timeLeft <= 0) {
      roundEndedRef.current = true;      // stop the clock
      return;                            // wait for user to click “Next Question”
    }
    if (roundEndedRef.current) return;   // safeguard

    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timeLeft]);

  /* ──────────────────── render ──────────────────── */
  return (
    <div className="h-screen bg-gradient-to-b from-[#2D0278] to-[#0A001D] p-4 flex flex-row overflow-hidden">
      <div className="w-full pr-2 flex flex-col h-full overflow-hidden">

        {/* ── prompt + timer ── */}
        {currentQuestion && (
          <div className="bg-white bg-opacity-20 p-4 rounded-md mb-4 border-2 border-purple-400">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-xl text-white font-semibold">Writing Prompt:</h2>
              <div
                className={`p-2 rounded-lg ${
                  timeLeft > 20
                    ? "bg-green-700"
                    : timeLeft > 10
                    ? "bg-yellow-600 animate-pulse"
                    : "bg-red-700 animate-pulse"
                } ml-4`}
              >
                <div className="text-xl font-mono text-white">{formatTime(timeLeft)}</div>
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

        {/* ── essay box ── */}
        <div className="flex flex-col bg-white bg-opacity-15 rounded-md p-4 mb-4 h-full border-2 border-blue-400 shadow-lg">
          <h3 className="text-xl text-white font-semibold mb-2">Your Essay</h3>
          <textarea
            value={finalAnswer}
            onChange={(e) => setFinalAnswer(e.target.value)}
            placeholder="Enter your response here..."
            className="w-full grow bg-white bg-opacity-10 text-white border border-gray-600 rounded-md px-3 py-3 text-lg"
          />

          {/* show button only after time expires */}
          {timeLeft <= 0 && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => handleNextQuestion(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md"
              >
                Next Question
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
