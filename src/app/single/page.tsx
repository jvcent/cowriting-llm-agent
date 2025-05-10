"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import TypewriterTextWrapper from "@/components/TypewriterTextWrapper";
import { aiService, AI_MODELS } from "@/services/AI";
import { Message } from "@/utils/types";
import { creativeTopics } from "@/data/creative";
import { argumentativeTopics } from "@/data/argumentative";
import { useFlow } from "@/context/FlowContext";
import { cleanText } from "@/utils/text";

// Types
interface Agent {
  id: string;
  name: string;
  avatar: string;
  systemPrompt: string;
}

interface TopicMap {
  [key: string]: Agent[];
}

export default function SinglePage() {
  const router = useRouter();
  const { addSingleEssay } = useFlow();

  // -----------------------------
  // STATE
  // -----------------------------
  const [messages, setMessages] = useState<Message[]>([]);
  const [, setCompletedMessageIds] = useState<number[]>([]);
  const [input, setInput] = useState("");
  const [finalAnswer, setFinalAnswer] = useState("");
  const [nextMessageId, setNextMessageId] = useState(3);
  const [typingMessageIds, setTypingMessageIds] = useState<number[]>([]);
  const [isQuestioningEnabled, setIsQuestioningEnabled] = useState(true);
  const [evaluationComplete, setEvaluationComplete] = useState(false);
  const [, setBotThinking] = useState(false);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [currentModel] = useState(AI_MODELS.CLAUDE_HAIKU.id);
  const [, setLastUserActivityTime] = useState(Date.now());

  const timerDuration = 300;
  const [loadedQuestions, setLoadedQuestions] = useState(false);
  const [timeLeft, setTimeLeft] = useState(timerDuration);

  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [currentAgents, setCurrentAgents] = useState<Agent[]>([]);
  const [currentQuestionType, setCurrentQuestionType] = useState<
    "creative" | "argumentative"
  >("creative");
  const [questionSequence] = useState<"creative" | "argumentative" | "break">(
    "creative"
  );

  const startTimeRef = useRef<number>(Date.now());
  const [hasGivenStarterFeedback, setHasGivenStarterFeedback] = useState(false);
  const [lastFeedbackWordCount, setLastFeedbackWordCount] = useState(0);

  const [, setScratchboardContent] = useState("");
  const [, setFeedbackSessionId] = useState(0);

  const roundEndedRef = useRef(false);

  // -----------------------------
  // ID MANAGEMENT
  // -----------------------------
  const nextMessageIdRef = useRef(3);
  const getUniqueMessageId = useCallback(() => {
    const id = nextMessageIdRef.current;
    nextMessageIdRef.current += 1;
    setNextMessageId(nextMessageIdRef.current);
    return id;
  }, []);

  // -----------------------------
  // SCROLL MANAGEMENT
  // -----------------------------
  const lastManualScrollTimeRef = useRef(0);
  const forceScrollToBottomRef = useRef(false);
  const manualScrollOverrideRef = useRef(false);

  const scrollToBottom = useCallback(
    (force = false) => {
      const c = chatContainerRef.current;
      if (!c) return;
      if (manualScrollOverrideRef.current && !force) return;
      if (force || forceScrollToBottomRef.current || !userHasScrolled) {
        c.scrollTo({
          top: c.scrollHeight,
          behavior: "smooth",
        });
        forceScrollToBottomRef.current = false;
      }
    },
    [userHasScrolled]
  );

  // Add auto-scroll effect when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleScroll = () => {
    const c = chatContainerRef.current;
    if (!c) return;
    if (Date.now() - lastManualScrollTimeRef.current < 50) return;
    const nearBottom =
      Math.abs(c.scrollHeight - c.scrollTop - c.clientHeight) < 150;
    setUserHasScrolled(!nearBottom);
    manualScrollOverrideRef.current = !nearBottom;
  };

  // -----------------------------
  // UTILS
  // -----------------------------
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const getWordCount = (text: string) =>
    text
      .trim()
      .split(/\s+/)
      .filter((w) => w).length;

  // -----------------------------
  // STATIC BOT MESSAGE
  // -----------------------------
  const postStaticMessageSequentially = useCallback(
    async (agent: Agent, text: string) => {
      const tempId = getUniqueMessageId();
      setMessages((prev) => [
        ...prev,
        {
          id: tempId,
          sender: "ai",
          text,
          agentId: agent.id,
          timestamp: new Date().toISOString(),
        },
      ]);

      // Add typing animation
      setTypingMessageIds((prev) => [...prev, tempId]);
      // Remove typing animation after a short delay
      setTimeout(() => {
        setTypingMessageIds((prev) => prev.filter((id) => id !== tempId));
      }, 1000);
    },
    [getUniqueMessageId]
  );

  // -----------------------------
  // CALLBACKS
  // -----------------------------
  const autoSubmitTimeoutAnswer = useCallback(() => {
    roundEndedRef.current = true;
    setIsQuestioningEnabled(false);
    setEvaluationComplete(true);

    if (finalAnswer.trim()) {
      const userMsg: Message = {
        id: getUniqueMessageId(),
        sender: "user",
        text: `My final answer is: ${finalAnswer}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setFinalAnswer("");
    }
  }, [finalAnswer, getUniqueMessageId]);

  const triggerStarterFeedback = useCallback(async () => {
    if (roundEndedRef.current || hasGivenStarterFeedback) return;
    setHasGivenStarterFeedback(true);
    const agent = currentAgents[0];
    if (!agent) return;

    await postStaticMessageSequentially(
      agent,
      "I notice you've been writing for a while. Would you like some feedback on your progress so far?"
    );
  }, [currentAgents, hasGivenStarterFeedback, postStaticMessageSequentially]);

  // -----------------------------
  // EFFECTS
  // -----------------------------
  // Keep user auto‑scrolled on new user message
  useEffect(() => {
    const latest = messages[messages.length - 1];
    if (latest?.sender === "user") {
      manualScrollOverrideRef.current = false;
      lastManualScrollTimeRef.current = Date.now();
      setTimeout(() => scrollToBottom(true), 50);
    }
  }, [messages, scrollToBottom]);

  // Load a random question + agent
  const fetchQuestions = useCallback(async () => {
    try {
      const topics: TopicMap =
        questionSequence === "creative" ? creativeTopics : argumentativeTopics;
      const keys = Object.keys(topics);
      const rk = keys[Math.floor(Math.random() * keys.length)];
      const agentsList = topics[rk];
      const agent = agentsList[Math.floor(Math.random() * agentsList.length)];

      setCurrentQuestionType(
        questionSequence === "break"
          ? "creative"
          : (questionSequence as "creative" | "argumentative")
      );
      setCurrentAgents([agent]);
      setCurrentQuestion(rk);
      setLoadedQuestions(true);
    } catch (err) {
      console.error(err);
    }
  }, [questionSequence]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // -----------------------------
  // AI RESPONSE
  // -----------------------------
  const generateAIResponse = async (userMessage: string) => {
    if (roundEndedRef.current) return;
    const agent = currentAgents[0];
    setBotThinking(true);

    const tempId = getUniqueMessageId();
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        sender: "ai",
        text: "...",
        agentId: agent.id,
        timestamp: new Date().toISOString(),
      },
    ]);

    try {
      const response = await aiService.generateResponse(
        [
          ...messages,
          {
            id: nextMessageId,
            sender: "user",
            text: userMessage,
            timestamp: new Date().toISOString(),
          },
        ],
        { systemPrompt: agent.systemPrompt, model: currentModel }
      );

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? { ...m, text: response, timestamp: new Date().toISOString() }
            : m
        )
      );

      // Add typing animation
      setTypingMessageIds((prev) => [...prev, tempId]);
      // Remove typing animation after a short delay
      setTimeout(() => {
        setTypingMessageIds((prev) => prev.filter((id) => id !== tempId));
      }, 1000);
    } catch (err) {
      console.error(err);
      setMessages((prev) => prev.filter((m) => m.text !== "..."));
    } finally {
      setBotThinking(false);
    }
  };

  const handleUserQuestion = () => {
    if (!input.trim() || typingMessageIds.length) return;

    const userText = input.trim();
    setLastUserActivityTime(Date.now());

    const msg: Message = {
      id: getUniqueMessageId(),
      sender: "user",
      text: userText,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, msg]);
    setInput("");
    forceScrollToBottomRef.current = true;
    setTimeout(() => scrollToBottom(true), 50);

    generateAIResponse(userText);
  };

  // -----------------------------
  // ROUND MANAGEMENT
  // -----------------------------
  const startNewRound = useCallback(
    async (overrideType?: "creative" | "argumentative") => {
      startTimeRef.current = Date.now();
      setLastUserActivityTime(Date.now());
      setHasGivenStarterFeedback(false);
      setFeedbackSessionId((p) => p + 1);
      setMessages([]);
      setCompletedMessageIds([]);
      setTypingMessageIds([]);
      setScratchboardContent("");
      setInput("");
      setFinalAnswer("");
      setEvaluationComplete(false);
      setUserHasScrolled(false);
      roundEndedRef.current = false;
      setTimeLeft(timerDuration);

      const chosen = overrideType ?? currentQuestionType;
      const topics: TopicMap =
        chosen === "creative" ? creativeTopics : argumentativeTopics;

      try {
        const keys = Object.keys(topics);
        const rk = keys[Math.floor(Math.random() * keys.length)];
        const agentsList = topics[rk];

        setCurrentQuestion(rk);
        setCurrentAgents(agentsList);

        if (agentsList.length) {
          await postStaticMessageSequentially(
            agentsList[0],
            `Let's work on this ${chosen} writing task together. I'm here to help you develop your ideas and explore different perspectives.`
          );
        }
        setIsQuestioningEnabled(true);
      } catch (err) {
        console.error(err);
      }
    },
    [currentQuestionType, postStaticMessageSequentially]
  );

  useEffect(() => {
    if (loadedQuestions) startNewRound();
  }, [loadedQuestions, startNewRound]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0) {
      if (isQuestioningEnabled) {
        autoSubmitTimeoutAnswer();
      }
      return;
    }
    if (roundEndedRef.current) return;

    const t = setTimeout(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(t);
  }, [timeLeft, isQuestioningEnabled, autoSubmitTimeoutAnswer]);

  // Starter feedback on idle (simple heuristic)
  useEffect(() => {
    if (lastFeedbackWordCount > 0 && !hasGivenStarterFeedback) {
      triggerStarterFeedback();
    }
  }, [lastFeedbackWordCount, hasGivenStarterFeedback, triggerStarterFeedback]);

  // -----------------------------
  // AUTO‑FEEDBACK
  // -----------------------------
  const triggerAutomaticFeedback = async (text: string) => {
    if (roundEndedRef.current) return;
    const agent = currentAgents[0];

    const msgId = getUniqueMessageId();
    setMessages((p) => [
      ...p,
      {
        id: msgId,
        sender: "ai",
        text: "...",
        agentId: agent.id,
        timestamp: new Date().toISOString(),
      },
    ]);

    const resp = await aiService.generateResponse(
      [
        {
          id: nextMessageId,
          sender: "user",
          text: `Please provide brief, constructive feedback on what has been written so far: "${text}"`,
          timestamp: new Date().toISOString(),
        },
      ],
      { systemPrompt: agent.systemPrompt, model: currentModel }
    );

    setMessages((p) =>
      p.map((m) =>
        m.id === msgId
          ? { ...m, text: resp, timestamp: new Date().toISOString() }
          : m
      )
    );

    // Add typing animation
    setTypingMessageIds((prev) => [...prev, msgId]);
    // Remove typing animation after a short delay
    setTimeout(() => {
      setTypingMessageIds((prev) => prev.filter((id) => id !== msgId));
    }, 1000);
  };

  // Essay change handler (word‑count based feedback trigger)
  const handleEssayChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const txt = e.target.value;
    setFinalAnswer(txt);
    const wc = getWordCount(txt);
    if (wc >= lastFeedbackWordCount + 35) {
      setLastFeedbackWordCount(wc);
      triggerAutomaticFeedback(txt);
    }
  };

  // Handle finish / move to next question
  const handleNextQuestion = () => {
    if (currentQuestion && finalAnswer) {
      const spent = Math.floor((Date.now() - startTimeRef.current) / 1000);
      addSingleEssay({
        questionType: currentQuestionType,
        question: currentQuestion,
        essay: finalAnswer,
        chatLog: messages,
        timeSpent: spent,
      });
    }

    if (currentQuestionType === "creative") {
      setCurrentQuestionType("argumentative");
      startTimeRef.current = Date.now();
      startNewRound("argumentative");
    } else {
      router.push("/completed");
    }
  };

  // -----------------------------
  // RENDER
  // -----------------------------
  return (
    <div className="h-screen bg-gradient-to-b from-[#2D0278] to-[#0A001D] p-4 flex flex-row overflow-hidden">
      {/* LEFT PANEL */}
      <div className="w-1/2 pr-2 flex flex-col h-full overflow-hidden">
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

        <div className="flex flex-col bg-white bg-opacity-15 rounded-md p-4 mb-4 h-full border-2 border-blue-400 shadow-lg">
          <h3 className="text-xl text-white font-semibold mb-2">Your Essay</h3>
          <textarea
            value={finalAnswer}
            onChange={handleEssayChange}
            placeholder="Write your response here…"
            disabled={timeLeft === 0}
            className={`w-full grow bg-white bg-opacity-10 text-white border border-gray-600 rounded-md px-3 py-3 text-lg ${
              timeLeft === 0 ? "opacity-50 cursor-not-allowed" : ""
            }`}
          />
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-1/2 pl-2 flex flex-col h-full">
        <div className="flex-1 bg-white bg-opacity-10 rounded-md flex flex-col overflow-hidden">
          <div className="bg-black bg-opacity-30 p-2">
            <div className="flex space-x-3 items-center">
              {currentAgents[0] && (
                <Image
                  src={currentAgents[0].avatar}
                  alt={currentAgents[0].name}
                  width={40}
                  height={40}
                  className="rounded-full"
                />
              )}
              <span className="ml-2 text-white font-medium">
                {currentAgents[0]?.name || "AI Assistant"}
              </span>
            </div>
          </div>

          {/* CHAT */}
          <div
            className="flex-1 p-4 overflow-y-auto"
            ref={chatContainerRef}
            onScroll={handleScroll}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`mb-4 flex ${
                  msg.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.sender === "ai" && (
                  <div className="mr-2 flex-shrink-0">
                    <Image
                      src={currentAgents[0].avatar}
                      alt={currentAgents[0].name}
                      width={40}
                      height={40}
                      className="rounded-full border-2 border-white"
                    />
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-lg p-3 ${
                    msg.sender === "user"
                      ? "bg-blue-600 text-white"
                      : msg.sender === "system"
                      ? "bg-purple-700 text-white"
                      : "bg-white bg-opacity-10 text-white"
                  }`}
                >
                  {msg.sender === "ai" && (
                    <div className="text-sm text-gray-300 mb-1 font-bold">
                      {currentAgents[0].name}
                    </div>
                  )}
                  {msg.sender === "system" && (
                    <div className="text-sm text-gray-300 mb-1 font-bold">
                      Official Solution
                    </div>
                  )}
                  {typingMessageIds.includes(msg.id) ? (
                    <TypewriterTextWrapper
                      key={msg.id}
                      text={cleanText(msg.text ?? "")}
                      speed={50}
                      onTypingProgress={() => {}}
                      onTypingComplete={() => {}}
                    />
                  ) : (
                    <div className="whitespace-pre-wrap">
                      {cleanText(msg.text ?? "")}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div key="messages-end" />
          </div>

          {isQuestioningEnabled && (
            <div className="p-3 bg-black bg-opacity-30">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="You can ask for feedback or help brainstorm at any point here"
                  className="flex-1 bg-white bg-opacity-10 text-white border border-gray-700 rounded-md px-3 py-2"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleUserQuestion();
                    }
                  }}
                />
                <button
                  onClick={handleUserQuestion}
                  disabled={!input.trim() || typingMessageIds.length > 0}
                  className={`px-4 py-2 rounded-md ${
                    input.trim() && !typingMessageIds.length
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-gray-700 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  Ask
                </button>
              </div>
            </div>
          )}

          {!isQuestioningEnabled && evaluationComplete && (
            <div className="p-3 bg-black bg-opacity-30 flex justify-center">
              <button
                onClick={handleNextQuestion}
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
