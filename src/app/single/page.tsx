"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import TypewriterText from "@/components/TypewriterText";
import { aiService, AI_MODELS } from "@/services/AI";
import { Message } from "@/utils/types";
import TypewriterTextWrapper from "@/components/TypewriterTextWrapper";
import { creativeTopics } from "@/data/creative";
import { argumentativeTopics } from "@/data/argumentative";
import { useFlow } from "@/context/FlowContext";

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
  const [completedMessageIds, setCompletedMessageIds] = useState<number[]>([]);
  const [input, setInput] = useState("");
  const [finalAnswer, setFinalAnswer] = useState("");
  const [nextMessageId, setNextMessageId] = useState(3);
  const [typingMessageIds, setTypingMessageIds] = useState<number[]>([]);
  const [isQuestioningEnabled, setIsQuestioningEnabled] = useState(true);
  const [evaluationComplete, setEvaluationComplete] = useState(false);
  const [botThinking, setBotThinking] = useState(false);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [currentModel] = useState(AI_MODELS.CLAUDE_HAIKU.id);
  const [lastUserActivityTime, setLastUserActivityTime] = useState(Date.now());

  // Questions from JSON
  const [loadedQuestions, setLoadedQuestions] = useState(false);

  // Timer state
  const timerDuration = 300;
  const [timeLeft, setTimeLeft] = useState(timerDuration);
  const roundEndedRef = useRef(false);

  // Question tracking
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [usedQuestionIndices, setUsedQuestionIndices] = useState<number[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);

  // Question type states
  const [currentQuestionType, setCurrentQuestionType] = useState<
    "creative" | "argumentative"
  >("creative");
  const [currentTopic, setCurrentTopic] = useState<any>(null);
  const [currentAgents, setCurrentAgents] = useState<any[]>([]);
  const [questionSequence, setQuestionSequence] = useState<
    "creative" | "argumentative" | "break"
  >("creative");

  // Track which bot spoke last
  const [lastSpeakingBot, setLastSpeakingBot] = useState<string | null>(null);

  // ID management
  const nextMessageIdRef = useRef(3);
  const getUniqueMessageId = () => {
    const id = nextMessageIdRef.current;
    nextMessageIdRef.current += 1;
    // Keep the state in sync for display (optional)
    setNextMessageId(nextMessageIdRef.current);
    return id;
  };

  // Utility
  const ensureNoTypingInProgress = (callback: () => void, maxDelay = 10000) => {
    const startTime = Date.now();

    const tryCallback = () => {
      if (Date.now() - startTime > maxDelay) {
        console.warn(
          "Timeout waiting for typing to complete, proceeding anyway"
        );
        callback();
        return;
      }

      if (typingMessageIds.length > 0) {
        setTimeout(tryCallback, 800);
        return;
      }
      callback();
    };
    tryCallback();
  };

  // Scroll management
  const currentMessageScrollOverrideRef = useRef(false);
  const lastManualScrollTimeRef = useRef(0);
  const forceScrollToBottomRef = useRef(false);
  const manualScrollOverrideRef = useRef(false);

  const scrollToBottom = (force = false) => {
    const chatContainer = chatContainerRef.current;
    if (!chatContainer) return;

    // Don't autoscroll if the user manually scrolled away, unless forced
    if (manualScrollOverrideRef.current && !force) {
      return;
    }

    if (force || forceScrollToBottomRef.current || !userHasScrolled) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
      forceScrollToBottomRef.current = false;
    }
  };

  const handleScroll = () => {
    const chatContainer = chatContainerRef.current;
    if (!chatContainer) return;

    const isProgrammaticScroll =
      Date.now() - lastManualScrollTimeRef.current < 50;
    if (isProgrammaticScroll) {
      return;
    }

    const isNearBottom =
      Math.abs(
        chatContainer.scrollHeight -
          chatContainer.scrollTop -
          chatContainer.clientHeight
      ) < 150;

    if (!isNearBottom) {
      setUserHasScrolled(true);
      manualScrollOverrideRef.current = true;
    } else {
      setUserHasScrolled(false);
      manualScrollOverrideRef.current = false;
    }
  };

  useEffect(() => {
    const latestMessage = messages[messages.length - 1];
    if (latestMessage && latestMessage.sender === "user") {
      manualScrollOverrideRef.current = false;
      lastManualScrollTimeRef.current = Date.now();
      setTimeout(() => {
        scrollToBottom(true);
      }, 50);
    }
  }, [messages.length]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const checkForBotMention = (message: string) => {
    // Hard-coded for "bob"
    return "bob";
  };

  const generateAIResponse = async (userMessage: string) => {
    if (roundEndedRef.current) return;
    const selectedAgent = currentAgents[0];
    setBotThinking(true);

    try {
      // Show temp "typing"
      const tempMessageId = getUniqueMessageId();
      setMessages((prev) => [
        ...prev,
        {
          id: tempMessageId,
          sender: "ai",
          text: "...",
          agentId: selectedAgent.id,
          timestamp: new Date().toISOString(),
        },
      ]);

      // Generate AI response using full message history
      const response = await aiService.generateResponse(
        messages.concat({
          id: nextMessageId,
          sender: "user",
          text: userMessage,
          timestamp: new Date().toISOString(),
        }),
        {
          systemPrompt: selectedAgent.systemPrompt,
          model: currentModel,
        }
      );

      // Replace the placeholder with actual text
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempMessageId
            ? {
                ...msg,
                text: response,
                timestamp: new Date().toISOString(),
              }
            : msg
        )
      );

      setTypingMessageIds((prev) => [...prev, tempMessageId]);
    } catch (error) {
      console.error("Error generating AI response:", error);
      setMessages((prev) => prev.filter((msg) => msg.text !== "..."));
    } finally {
      setBotThinking(false);
    }
  };

  const handleUserQuestion = () => {
    if (!input.trim() || typingMessageIds.length > 0) return;
    setLastUserActivityTime(Date.now());

    const userMessage: Message = {
      id: getUniqueMessageId(),
      sender: "user",
      text: input,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    forceScrollToBottomRef.current = true;
    setTimeout(() => scrollToBottom(true), 50);

    generateAIResponse(userMessage.text || "");
  };

  // Loading questions
  const fetchQuestions = async () => {
    try {
      const topics =
        questionSequence === "creative" ? creativeTopics : argumentativeTopics;
      const topicKeys = Object.keys(topics) as (keyof typeof topics)[];
      const randomTopicKey =
        topicKeys[Math.floor(Math.random() * topicKeys.length)];
      const selectedTopic = topics[randomTopicKey];

      const agents = selectedTopic as any[];
      const randomAgent = agents[Math.floor(Math.random() * agents.length)];

      setCurrentQuestionType(
        questionSequence === "break" ? "creative" : questionSequence
      );
      setCurrentTopic(randomTopicKey);
      setCurrentAgents([randomAgent]);
      setLoadedQuestions(true);
      setCurrentQuestion(randomTopicKey);
    } catch (error) {
      console.error("Error loading questions:", error);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [questionSequence]);

  // Add start time tracking
  const startTimeRef = useRef(Date.now());

  // Move to next question or to "break" route
  const handleNextQuestion = () => {
    // Save current essay data before moving to next
    if (currentQuestion && finalAnswer) {
      const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);
      addSingleEssay({
        questionType: currentQuestionType,
        question: currentQuestion,
        essay: finalAnswer,
        chatLog: messages,
        timeSpent,
      });
    }

    if (currentQuestionType === "creative") {
      setCurrentQuestionType("argumentative");
      startTimeRef.current = Date.now(); // Reset start time
      startNewRound("argumentative");
    } else {
      router.push("/completed");
    }
  };

  // Update startNewRound to reset start time
  const startNewRound = async (overrideSet?: "creative" | "argumentative") => {
    // Reset start time when starting new round
    startTimeRef.current = Date.now();

    // Reset idle tracking
    setLastWritingTime(Date.now());
    setHasGivenStarterFeedback(false);

    // Create a new session concurrency so partial responses won't overlap
    setFeedbackSessionId((prev) => prev + 1);

    // Reset chat states
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

    // Decide which set we'll use (creative vs argumentative)
    const chosenSet = overrideSet ?? currentQuestionType;
    let topics: TopicMap =
      chosenSet === "creative" ? creativeTopics : argumentativeTopics;

    try {
      // Pick a random question (key in the object)
      const keys = Object.keys(topics);
      const randomKey = keys[Math.floor(Math.random() * keys.length)];
      const selectedTopic = topics[randomKey];
      setCurrentQuestion(randomKey);
      setCurrentAgents(selectedTopic);

      // Just send one introductory message from the first agent
      if (selectedTopic.length > 0) {
        const mainAgent = selectedTopic[0];
        await postStaticMessageSequentially(
          mainAgent,
          `Let's work on this ${chosenSet} writing task together. I'm here to help you develop your ideas and explore different perspectives.`
        );
      }

      setIsQuestioningEnabled(true);
    } catch (err) {
      console.error("Error starting round:", err);
    }
  };

  useEffect(() => {
    if (loadedQuestions) {
      startNewRound();
    }
  }, [loadedQuestions]);

  const autoSubmitTimeoutAnswer = () => {
    if (isQuestioningEnabled) {
      // Only do this if round hasn't already ended
      setIsQuestioningEnabled(false);
      roundEndedRef.current = true;
      setEvaluationComplete(true);
    }
  };

  const handleSend = () => {
    if (!finalAnswer.trim() || typingMessageIds.length > 0) return;
    setLastUserActivityTime(Date.now());
    setIsQuestioningEnabled(false);
    roundEndedRef.current = true;
    setEvaluationComplete(true);
  };

  // Timer to track the user's overall time per question
  useEffect(() => {
    if (timeLeft <= 0) {
      if (isQuestioningEnabled) {
        autoSubmitTimeoutAnswer();
      }
      return;
    }
    if (roundEndedRef.current) {
      return;
    }

    const timerId = setTimeout(() => {
      setTimeLeft((prevTime) => prevTime - 1);
    }, 1000);

    return () => clearTimeout(timerId);
  }, [timeLeft, isQuestioningEnabled]);

  // Add word count tracking
  const [lastFeedbackWordCount, setLastFeedbackWordCount] = useState(0);
  const WORD_COUNT_THRESHOLD = 35;

  // Add word counting utility
  const getWordCount = (text: string) => {
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  };

  // Add idle time tracking
  const [lastWritingTime, setLastWritingTime] = useState<number>(Date.now());
  const [hasGivenStarterFeedback, setHasGivenStarterFeedback] = useState(false);
  const IDLE_THRESHOLD = 60000; // 1 minute in milliseconds

  // Check for idle time and low word count
  useEffect(() => {
    if (roundEndedRef.current || hasGivenStarterFeedback) return;

    const checkIdleInterval = setInterval(() => {
      const currentTime = Date.now();
      const currentWordCount = getWordCount(finalAnswer);

      if (
        currentWordCount < WORD_COUNT_THRESHOLD &&
        currentTime - lastWritingTime >= IDLE_THRESHOLD
      ) {
        triggerStarterFeedback();
        setHasGivenStarterFeedback(true);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(checkIdleInterval);
  }, [lastWritingTime, finalAnswer, hasGivenStarterFeedback]);

  const triggerStarterFeedback = async () => {
    if (roundEndedRef.current) return;

    const selectedAgent = currentAgents[0];
    const messageId = getUniqueMessageId();

    // Add AI message placeholder
    setMessages((prev) => [
      ...prev,
      {
        id: messageId,
        sender: "ai",
        text: "...",
        agentId: selectedAgent.id,
        timestamp: new Date().toISOString(),
      },
    ]);

    // Generate response without showing the prompt
    const response = await aiService.generateResponse(
      [
        {
          id: nextMessageId,
          sender: "user",
          text: `The user is looking at the writing prompt: "${currentQuestion}". Without mentioning that they haven't started yet, provide encouraging suggestions for how to approach this prompt and get started writing.`,
          timestamp: new Date().toISOString(),
        },
      ],
      {
        systemPrompt: selectedAgent.systemPrompt,
        model: currentModel,
      }
    );

    // Update the message with the response
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              text: response,
              timestamp: new Date().toISOString(),
            }
          : msg
      )
    );

    setTypingMessageIds((prev) => [...prev, messageId]);
  };

  const triggerAutomaticFeedback = async (text: string) => {
    if (roundEndedRef.current) return;

    const selectedAgent = currentAgents[0];
    const messageId = getUniqueMessageId();

    // Add AI message placeholder
    setMessages((prev) => [
      ...prev,
      {
        id: messageId,
        sender: "ai",
        text: "...",
        agentId: selectedAgent.id,
        timestamp: new Date().toISOString(),
      },
    ]);

    // Generate response without showing the prompt
    const response = await aiService.generateResponse(
      [
        {
          id: nextMessageId,
          sender: "user",
          text: `Please provide brief, constructive feedback on what has been written so far: "${text}"`,
          timestamp: new Date().toISOString(),
        },
      ],
      {
        systemPrompt: selectedAgent.systemPrompt,
        model: currentModel,
      }
    );

    // Update the message with the response
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              text: response,
              timestamp: new Date().toISOString(),
            }
          : msg
      )
    );

    setTypingMessageIds((prev) => [...prev, messageId]);
  };

  // -----------------------------
  // ESSAY (WITHOUT AUTO FEEDBACK)
  // -----------------------------
  const handleEssayChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setFinalAnswer(newText);
    setLastWritingTime(Date.now());

    // Check word count and trigger feedback if needed
    const currentWordCount = getWordCount(newText);
    if (currentWordCount >= lastFeedbackWordCount + WORD_COUNT_THRESHOLD) {
      setLastFeedbackWordCount(currentWordCount);
      triggerAutomaticFeedback(newText);
    }
  };

  // Add feedbackSessionId state
  const [feedbackSessionId, setFeedbackSessionId] = useState(0);

  // Add missing function
  const postStaticMessageSequentially = async (agent: Agent, text: string) => {
    const messageId = getUniqueMessageId();
    setMessages((prev) => [
      ...prev,
      {
        id: messageId,
        sender: "ai",
        text: "...",
        agentId: agent.id,
        timestamp: new Date().toISOString(),
      },
    ]);

    await new Promise((res) => setTimeout(res, 200));

    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, text } : m))
    );

    setTypingMessageIds((prev) => [...prev, messageId]);
    await waitForTypingToFinish(messageId);
  };

  // Chat state
  const [scratchboardContent, setScratchboardContent] = useState("");
  const typingMessageIdsRef = useRef<number[]>([]);

  // Keep typing IDs in a ref for easy checks
  useEffect(() => {
    typingMessageIdsRef.current = typingMessageIds;
  }, [typingMessageIds]);

  // Helper function to wait for typing to finish
  const waitForTypingToFinish = (messageId: number): Promise<void> => {
    return new Promise((resolve) => {
      const check = () => {
        if (!typingMessageIdsRef.current.includes(messageId)) {
          resolve();
        } else {
          setTimeout(check, 150);
        }
      };
      check();
    });
  };

  // -----------------------------
  // RENDER
  // -----------------------------
  return (
    <div className="h-screen bg-gradient-to-b from-[#2D0278] to-[#0A001D] p-4 flex flex-row overflow-hidden">
      {/* LEFT PANEL */}
      <div className="w-1/2 pr-2 flex flex-col h-full overflow-hidden">
        {/* Problem Display + Timer */}
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

        {/* Final Answer Textarea */}
        <div className="flex flex-col bg-white bg-opacity-15 rounded-md p-4 mb-4 h-full border-2 border-blue-400 shadow-lg">
          <h3 className="text-xl text-white font-semibold mb-2">Your Essay</h3>
          <div className="flex grow flex-col space-y-3">
            <textarea
              value={finalAnswer}
              onChange={handleEssayChange}
              placeholder="Enter your response here..."
              className="w-full grow bg-white bg-opacity-10 text-white border border-gray-600 rounded-md px-3 py-3 text-lg"
            />
          </div>
        </div>
      </div>

      {/* RIGHT PANEL - Chat */}
      <div className="w-1/2 pl-2 flex flex-col h-full">
        <div className="flex-1 bg-white bg-opacity-10 rounded-md flex flex-col overflow-hidden">
          <div className="bg-black bg-opacity-30 p-2">
            <div className="flex space-x-3">
              <div className="flex items-center">
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
          </div>

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
                      key={`typewriter-${msg.id}`}
                      text={msg.text}
                      speed={20}
                      messageId={msg.id}
                      onTypingProgress={(progress) => {
                        if (!userHasScrolled) {
                          scrollToBottom();
                        }
                      }}
                      onTypingComplete={() => {
                        setTimeout(() => {
                          if (typingMessageIds.includes(msg.id)) {
                            setTypingMessageIds((prev) =>
                              prev.filter((id) => id !== msg.id)
                            );
                            setCompletedMessageIds((prev) => [...prev, msg.id]);
                            if (!userHasScrolled) {
                              scrollToBottom();
                            }
                          }
                        }, 100);
                      }}
                    />
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                  )}
                </div>
              </div>
            ))}
            <div key="messages-end" />
          </div>

          {/* Chat input for user questions */}
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
                    input.trim() && typingMessageIds.length === 0
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-gray-700 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  Ask
                </button>
              </div>
            </div>
          )}

          {/* Next question button (after time's up or submission) */}
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
