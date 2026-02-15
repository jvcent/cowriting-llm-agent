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

// CREATIVE WRITING AGENTS
const CLAUDE_AGENT_CREATIVE: Agent = {
  id: "claude",
  name: "Claude",
  avatar: "/claude_avatar.png",
  systemPrompt: `
    You are Claude, a helpful AI writing assistant for creative writing. 
    Through your advice and suggestions, your goal is to help maximize these dimensions in the user's writing:
    - Originality: Unique ideas, fresh perspectives, and creative approaches
    - Narrative structure & coherence: Clear plot flow and story consistency
    - Elaboration and richness: Vivid details and descriptive language
    - Expressiveness and emotional impact: Evocative writing that resonates
    - Literary quality and language use: Sophisticated vocabulary and prose style
    
    Provide clear, concise guidance (≤ 50 words) focused on the prompt: "{{PROMPT}}"
    Always address the user as "you".
  `,
};

const CHATGPT_AGENT_CREATIVE: Agent = {
  id: "chatgpt",
  name: "ChatGPT",
  avatar: "/gpt_avatar.png",
  systemPrompt: `
    You are ChatGPT, powered by GPT-5.2, a helpful AI writing assistant for creative writing. 
    Through your advice and suggestions, your goal is to help maximize these dimensions in the user's writing:
    - Originality: Unique ideas, fresh perspectives, and creative approaches
    - Narrative structure & coherence: Clear plot flow and story consistency
    - Elaboration and richness: Vivid details and descriptive language
    - Expressiveness and emotional impact: Evocative writing that resonates
    - Literary quality and language use: Sophisticated vocabulary and prose style
    
    Provide clear, concise guidance (≤ 50 words) focused on the prompt: "{{PROMPT}}"
    Always address the user as "you".
  `,
};

// ARGUMENTATIVE WRITING AGENTS
const CLAUDE_AGENT_ARGUMENTATIVE: Agent = {
  id: "claude",
  name: "Claude",
  avatar: "/claude_avatar.png",
  systemPrompt: `
    You are Claude, a helpful AI writing assistant for argumentative writing. 
    Through your advice and suggestions, your goal is to help maximize these dimensions in the user's writing:
    - Argument clarity: Clear thesis and well-defined positions
    - Strength of evidence and reasoning: Robust support for claims
    - Logical structure and organization: Coherent argument progression
    - Integration of counterarguments: Acknowledging and addressing opposing views
    - Persuasiveness: Compelling and convincing rhetoric
    - Language and formality: Appropriate academic or formal tone
    
    Provide clear, concise guidance (≤ 50 words) focused on the prompt: "{{PROMPT}}"
    Always address the user as "you".
  `,
};

const CHATGPT_AGENT_ARGUMENTATIVE: Agent = {
  id: "chatgpt",
  name: "ChatGPT",
  avatar: "/gpt_avatar.png",
  systemPrompt: `
    You are ChatGPT, powered by GPT-5.2, a helpful AI writing assistant for argumentative writing. 
    Through your advice and suggestions, your goal is to help maximize these dimensions in the user's writing:
    - Argument clarity: Clear thesis and well-defined positions
    - Strength of evidence and reasoning: Robust support for claims
    - Logical structure and organization: Coherent argument progression
    - Integration of counterarguments: Acknowledging and addressing opposing views
    - Persuasiveness: Compelling and convincing rhetoric
    - Language and formality: Appropriate academic or formal tone
    
    Provide clear, concise guidance (≤ 50 words) focused on the prompt: "{{PROMPT}}"
    Always address the user as "you".
  `,
};

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
  const [typingMessageIds, setTypingMessageIds] = useState<number[]>([]);
  const [isQuestioningEnabled, setIsQuestioningEnabled] = useState(true);
  const [evaluationComplete, setEvaluationComplete] = useState(false);
  const [, setBotThinking] = useState(false);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [currentModel] = useState(AI_MODELS.CLAUDE_OPUS_4_5.id);
  const [, setLastUserActivityTime] = useState(Date.now());

  const timerDuration = 420; // 7 minutes in seconds
  const [loadedQuestions, setLoadedQuestions] = useState(false);
  const [timeLeft, setTimeLeft] = useState(timerDuration);
  const [canAdvanceQuestion, setCanAdvanceQuestion] = useState(false); // at 4 mins
  const [showTimeWarning, setShowTimeWarning] = useState(false); // at 5 mins

  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [currentAgents, setCurrentAgents] = useState<Agent[]>([
    CLAUDE_AGENT_CREATIVE,
  ]);
  const [assignedAgentId, setAssignedAgentId] = useState<string | null>(null);
  const [assignedAgentName, setAssignedAgentName] = useState<string | null>(
    null,
  );
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [currentQuestionType, setCurrentQuestionType] = useState<
    "creative" | "argumentative"
  >("creative");
  const [questionSequence] = useState<"creative" | "argumentative" | "break">(
    "creative",
  );

  const startTimeRef = useRef<number>(Date.now());
  const [hasGivenStarterFeedback, setHasGivenStarterFeedback] = useState(false);
  const [lastFeedbackWordCount, setLastFeedbackWordCount] = useState(0);
  const [hasGiven20WordFeedback, setHasGiven20WordFeedback] = useState(false);

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
    [userHasScrolled],
  );

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

      setTypingMessageIds((prev) => [...prev, tempId]);
      setTimeout(() => {
        setTypingMessageIds((prev) => prev.filter((id) => id !== tempId));
      }, 3000);
    },
    [getUniqueMessageId],
  );

  // -----------------------------
  // CALLBACKS
  // -----------------------------
  const autoSubmitTimeoutAnswer = useCallback(() => {
    roundEndedRef.current = true;
    setIsQuestioningEnabled(false);
    setEvaluationComplete(true);
    // Don't add the answer to chat or clear it - it will be saved when user clicks Next Question
  }, []);

  const triggerStarterFeedback = useCallback(async () => {
    if (roundEndedRef.current || hasGivenStarterFeedback) return;
    setHasGivenStarterFeedback(true);
    const defaultAgent =
      currentQuestionType === "creative"
        ? CLAUDE_AGENT_CREATIVE
        : CLAUDE_AGENT_ARGUMENTATIVE;
    const agent = currentAgents[0] || defaultAgent;
    await postStaticMessageSequentially(
      agent,
      "I notice you've been writing for a while. Would you like some feedback on your progress so far?",
    );
  }, [hasGivenStarterFeedback, postStaticMessageSequentially, currentAgents]);

  // Trigger brainstorming help if user hasn't written enough after 60 seconds
  const triggerBrainstormingHelp = useCallback(async () => {
    if (roundEndedRef.current || hasGivenStarterFeedback) return;
    setHasGivenStarterFeedback(true);
    const defaultAgent =
      currentQuestionType === "creative"
        ? CLAUDE_AGENT_CREATIVE
        : CLAUDE_AGENT_ARGUMENTATIVE;
    const agent = currentAgents[0] || defaultAgent;

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

    try {
      const resp = await aiService.generateResponse(
        [
          {
            id: nextMessageIdRef.current,
            sender: "user",
            text: `I'm struggling to get started with this writing prompt. Can you help me brainstorm some ideas or angles to approach it? Here's the prompt: "${currentQuestion}"`,
            timestamp: new Date().toISOString(),
          },
        ],
        {
          systemPrompt: agent.systemPrompt.replace(
            "{{PROMPT}}",
            currentQuestion || "",
          ),
          model: currentModel,
        },
      );

      setMessages((p) =>
        p.map((m) =>
          m.id === msgId
            ? { ...m, text: resp, timestamp: new Date().toISOString() }
            : m,
        ),
      );

      setTypingMessageIds((prev) => [...prev, msgId]);
      setTimeout(() => {
        setTypingMessageIds((prev) => prev.filter((id) => id !== msgId));
      }, 3000);
    } catch (err) {
      console.error(err);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    }
  }, [
    hasGivenStarterFeedback,
    currentAgents,
    currentQuestion,
    currentModel,
    getUniqueMessageId,
  ]);

  // -----------------------------
  // EFFECTS
  // -----------------------------
  useEffect(() => {
    const latest = messages[messages.length - 1];
    if (latest?.sender === "user") {
      manualScrollOverrideRef.current = false;
      lastManualScrollTimeRef.current = Date.now();
      setTimeout(() => scrollToBottom(true), 50);
    }
  }, [messages, scrollToBottom]);

  // Load a random question
  const fetchQuestions = useCallback(async () => {
    const topics =
      questionSequence === "creative"
        ? Object.keys(creativeTopics)
        : Object.keys(argumentativeTopics);
    const rk = topics[Math.floor(Math.random() * topics.length)];

    setCurrentQuestionType(
      questionSequence === "break"
        ? "creative"
        : (questionSequence as "creative" | "argumentative"),
    );
    setCurrentAgents([CLAUDE_AGENT_CREATIVE]);
    setCurrentQuestion(rk);
    setTimeLeft(timerDuration);
    setLoadedQuestions(true);
  }, [questionSequence, timerDuration]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // -----------------------------
  // AI RESPONSE
  // -----------------------------
  const generateAIResponse = async (userMessage: string) => {
    if (roundEndedRef.current) return;
    const defaultAgent =
      currentQuestionType === "creative"
        ? CLAUDE_AGENT_CREATIVE
        : CLAUDE_AGENT_ARGUMENTATIVE;
    const agent = currentAgents[0] || defaultAgent;
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
            id: nextMessageIdRef.current,
            sender: "user",
            text: userMessage,
            timestamp: new Date().toISOString(),
          },
        ],
        {
          systemPrompt: agent.systemPrompt.replace(
            "{{PROMPT}}",
            currentQuestion || "",
          ),
          model: currentModel,
        },
      );

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? { ...m, text: response, timestamp: new Date().toISOString() }
            : m,
        ),
      );

      setTypingMessageIds((prev) => [...prev, tempId]);
      setTimeout(() => {
        setTypingMessageIds((prev) => prev.filter((id) => id !== tempId));
      }, 3000);
    } catch (err) {
      console.error(err);
      setMessages((prev) => prev.filter((m) => m.text !== "..."));
    } finally {
      setBotThinking(false);
    }
  };

  const handleUserQuestion = useCallback(() => {
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
  }, [
    input,
    typingMessageIds.length,
    getUniqueMessageId,
    generateAIResponse,
    scrollToBottom,
  ]);

  // -----------------------------
  // ROUND MANAGEMENT
  // -----------------------------
  const startNewRound = useCallback(
    async (overrideType?: "creative" | "argumentative") => {
      startTimeRef.current = Date.now();
      setLastUserActivityTime(Date.now());
      setHasGivenStarterFeedback(false);
      setHasGiven20WordFeedback(false);
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
      setCanAdvanceQuestion(false);
      setShowTimeWarning(false);

      const chosen = overrideType ?? currentQuestionType;
      const topics =
        chosen === "creative"
          ? Object.keys(creativeTopics)
          : Object.keys(argumentativeTopics);

      try {
        const rk = topics[Math.floor(Math.random() * topics.length)];
        setCurrentQuestion(rk);

        // Use the pre-selected agent (randomized only once at start)
        const baseAgent = selectedAgent || CLAUDE_AGENT_CREATIVE;

        // Select appropriate version based on essay type
        let agentToUse: Agent;
        if (chosen === "creative") {
          agentToUse =
            baseAgent.id === "chatgpt"
              ? CHATGPT_AGENT_CREATIVE
              : CLAUDE_AGENT_CREATIVE;
        } else {
          agentToUse =
            baseAgent.id === "chatgpt"
              ? CHATGPT_AGENT_ARGUMENTATIVE
              : CLAUDE_AGENT_ARGUMENTATIVE;
        }

        const agentWithPrompt = {
          ...agentToUse,
          systemPrompt: agentToUse.systemPrompt.replace("{{PROMPT}}", rk),
        };
        setCurrentAgents([agentWithPrompt]);
        // Explicitly store the assigned agent type
        setAssignedAgentId(agentToUse.id);
        setAssignedAgentName(agentToUse.name);
        setIsQuestioningEnabled(true);
      } catch (err) {
        console.error(err);
      }
    },
    [currentQuestionType, selectedAgent],
  );

  // Initialize selected agent once on first load
  useEffect(() => {
    if (loadedQuestions && !selectedAgent) {
      const agent =
        Math.random() > 0.5 ? CLAUDE_AGENT_CREATIVE : CHATGPT_AGENT_CREATIVE;
      setSelectedAgent(agent);
      setTimeLeft(timerDuration);
    }
  }, [loadedQuestions, selectedAgent, timerDuration]);

  // Check for brainstorming trigger (60 seconds with <20 words)
  useEffect(() => {
    if (roundEndedRef.current || hasGivenStarterFeedback || !loadedQuestions)
      return;

    const checkBrainstormingInterval = setInterval(() => {
      const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000;
      const wc = getWordCount(finalAnswer);

      // After 60 seconds, if still <20 words, trigger brainstorming
      if (elapsedSeconds >= 60 && wc < 20) {
        triggerBrainstormingHelp();
      }
    }, 1000);

    return () => clearInterval(checkBrainstormingInterval);
  }, [
    loadedQuestions,
    hasGivenStarterFeedback,
    finalAnswer,
    triggerBrainstormingHelp,
  ]);

  useEffect(() => {
    if (loadedQuestions && selectedAgent) startNewRound();
  }, [loadedQuestions, selectedAgent, startNewRound]);

  // Next question / finish
  const handleNextQuestion = useCallback(() => {
    if (currentQuestion) {
      const spent = Math.floor((Date.now() - startTimeRef.current) / 1000);
      addSingleEssay({
        questionType: currentQuestionType,
        question: currentQuestion,
        essay: finalAnswer || "[No answer provided]",
        chatLog: messages,
        timeSpent: spent,
        assignedAgentId: assignedAgentId || undefined,
        assignedAgentName: assignedAgentName || undefined,
      });
    }

    if (currentQuestionType === "creative") {
      setCurrentQuestionType("argumentative");
      startTimeRef.current = Date.now();
      startNewRound("argumentative");
    } else {
      router.push("/completed");
    }
  }, [
    currentQuestion,
    currentQuestionType,
    finalAnswer,
    messages,
    assignedAgentId,
    assignedAgentName,
    addSingleEssay,
    startNewRound,
    router,
  ]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0) {
      // Auto-submit at 7 mins (420 seconds)
      handleNextQuestion();
      return;
    }
    if (roundEndedRef.current) return;

    const t = setTimeout(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [timeLeft, handleNextQuestion]);

  // Enable "Next Question" button at 4 mins (240 seconds remaining)
  useEffect(() => {
    if (timeLeft <= 240) {
      setCanAdvanceQuestion(true);
    }
  }, [timeLeft]);

  // Show warning at 5 mins (300 seconds remaining)
  useEffect(() => {
    if (timeLeft === 300) {
      setShowTimeWarning(true);
    }
  }, [timeLeft]);

  // Warning at 2 minutes left
  useEffect(() => {
    if (timeLeft === 120 && !finalAnswer.trim()) {
      setShowWarning(true);
    }
  }, [timeLeft, finalAnswer]);

  // AUTO-FEEDBACK
  const triggerAutomaticFeedback = useCallback(
    async (text: string) => {
      if (roundEndedRef.current) return;
      const defaultAgent =
        currentQuestionType === "creative"
          ? CLAUDE_AGENT_CREATIVE
          : CLAUDE_AGENT_ARGUMENTATIVE;
      const agent = currentAgents[0] || defaultAgent;

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
            id: nextMessageIdRef.current,
            sender: "user",
            text: `Please provide brief, constructive feedback on what has been written so far: "${text}"`,
            timestamp: new Date().toISOString(),
          },
        ],
        {
          systemPrompt: agent.systemPrompt.replace(
            "{{PROMPT}}",
            currentQuestion || "",
          ),
          model: currentModel,
        },
      );

      setMessages((p) =>
        p.map((m) =>
          m.id === msgId
            ? { ...m, text: resp, timestamp: new Date().toISOString() }
            : m,
        ),
      );

      setTypingMessageIds((prev) => [...prev, msgId]);
      setTimeout(() => {
        setTypingMessageIds((prev) => prev.filter((id) => id !== msgId));
      }, 3000);
    },
    [currentAgents, currentQuestion, currentModel, getUniqueMessageId],
  );

  // Essay change handler
  const handleEssayChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const txt = e.target.value;
      setFinalAnswer(txt);
      const wc = getWordCount(txt);

      // Trigger feedback when user reaches >20 words (only once)
      if (wc > 20 && !hasGiven20WordFeedback) {
        setHasGiven20WordFeedback(true);
        triggerAutomaticFeedback(txt);
      }
    },
    [hasGiven20WordFeedback, triggerAutomaticFeedback],
  );

  // RENDER
  return (
    <div className="h-screen bg-gradient-to-b from-[#2D0278] to-[#0A001D] p-4 flex flex-row overflow-hidden">
      {showWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md">
            <p className="text-lg mb-4">
              You have not provided any response. This may result in
              disqualification from this task and{" "}
              <span className="text-red-600"> loss of payment.</span> Please
              provide your answer before moving on to the next question.
            </p>
            <button
              onClick={() => setShowWarning(false)}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
              I Understand
            </button>
          </div>
        </div>
      )}
      {/* LEFT PANEL */}
      <div className="w-1/2 pr-2 flex flex-col h-full overflow-hidden">
        {currentQuestion && (
          <div className="bg-white bg-opacity-20 p-4 rounded-md mb-4 border-2 border-purple-400">
            <h2 className="text-xl text-white font-semibold mb-2">
              Writing Prompt:
            </h2>
            <p className="text-white text-lg">{currentQuestion}</p>
          </div>
        )}
        {/* Time warning message */}
        {showTimeWarning && (
          <div className="bg-yellow-600 bg-opacity-80 p-3 rounded-md mb-4 border-2 border-yellow-400">
            <p className="text-white text-center font-semibold">
              ⏱️ You have 2 more minutes remaining
            </p>
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
          <div className="bg-black bg-opacity-30 p-2 flex space-x-3 items-center">
            <Image
              src={currentAgents[0]?.avatar || CLAUDE_AGENT_CREATIVE.avatar}
              alt={currentAgents[0]?.name || CLAUDE_AGENT_CREATIVE.name}
              width={40}
              height={40}
              className="rounded-full"
            />
            <span className="ml-2 text-white font-medium">
              {currentAgents[0]?.name || CLAUDE_AGENT_CREATIVE.name}
            </span>
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
                      src={
                        currentAgents[0]?.avatar || CLAUDE_AGENT_CREATIVE.avatar
                      }
                      alt={currentAgents[0]?.name || CLAUDE_AGENT_CREATIVE.name}
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
                      {currentAgents[0]?.name || CLAUDE_AGENT_CREATIVE.name}
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
                  placeholder="Ask for help or advice. E.g., you may write 'Help me brainstorm ideas....'"
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
          {isQuestioningEnabled && canAdvanceQuestion && timeLeft > 0 && (
            <div className="p-3 bg-black bg-opacity-30 flex justify-center">
              <button
                onClick={handleNextQuestion}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md"
              >
                Proceed to Next Question
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
