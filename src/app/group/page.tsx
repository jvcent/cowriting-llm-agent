// ----------------------------------------------------------------
// GroupPage component – agents capped to MAX_AGENTS_PER_ROUND = 3
// ----------------------------------------------------------------

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

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------
interface Agent {
  id: string;
  name: string;
  avatar: string;
  systemPrompt: string;
  introMessage: string;
}

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------
const MAX_AGENTS_PER_ROUND = 2; // change this if you ever need more agents

// Default agents
const CLAUDE_AGENT: Agent = {
  id: "claude",
  name: "Claude",
  avatar: "/claude_avatar.png",
  systemPrompt: `
    You are Claude, a helpful AI writing assistant. 
    Your job is to support the user in completing their writing task. 
    Provide clear, concise guidance (≤ 50 words). 
    Always address them as "you". 
    Focus only on the writing prompt provided: "{{PROMPT}}"
  `,
  introMessage: "I'm Claude, here to help with your writing.",
};

const CHATGPT_AGENT: Agent = {
  id: "chatgpt",
  name: "ChatGPT",
  avatar: "/gpt_avatar.png",
  systemPrompt: `
    You are ChatGPT, powered by GPT-5.2, a helpful AI writing assistant. 
    Your job is to support the user in completing their writing task. 
    Provide clear, concise guidance (≤ 50 words). 
    Always address them as "you". 
    Focus only on the writing prompt provided: "{{PROMPT}}"
  `,
  introMessage: "I'm ChatGPT (GPT-5.2), ready to assist with your writing.",
};

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------
export default function GroupPage() {
  const router = useRouter();
  const { addGroupEssay } = useFlow();

  // State for chat messages & tracking
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingMessageIds, setTypingMessageIds] = useState<number[]>([]);
  const typingMessageIdsRef = useRef<number[]>([]);
  const nextMessageIdRef = useRef(3);

  // For user input & final answer
  const [scratchboardContent, setScratchboardContent] = useState("");
  const [input, setInput] = useState("");
  const [finalAnswer, setFinalAnswer] = useState("");

  // Chat container and scroll management
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const manualScrollOverrideRef = useRef(false);
  const lastManualScrollTimeRef = useRef(0);
  const forceScrollToBottomRef = useRef(false);

  const scrollToBottom = useCallback(
    (force = false) => {
      const chatContainer = chatContainerRef.current;
      if (!chatContainer) return;

      // If user manually scrolled up, do not auto-scroll unless `force` is true
      if (manualScrollOverrideRef.current && !force) return;

      if (force || forceScrollToBottomRef.current || !userHasScrolled) {
        chatContainer.scrollTo({
          top: chatContainer.scrollHeight,
          behavior: "smooth",
        });
        forceScrollToBottomRef.current = false;
      }
    },
    [userHasScrolled],
  );

  // Add auto-scroll effect when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Discussion states
  const [isQuestioningEnabled, setIsQuestioningEnabled] = useState(true);
  const [evaluationComplete, setEvaluationComplete] = useState(false);

  // Timer states
  const timerDuration = 10;
  const [timeLeft, setTimeLeft] = useState(timerDuration);
  const roundEndedRef = useRef(false);

  // Model & concurrency session
  const [currentModel] = useState(AI_MODELS.CLAUDE_HAIKU.id);
  const [feedbackSessionId, setFeedbackSessionId] = useState(0);

  // Question sets
  const [currentQuestionSet, setCurrentQuestionSet] = useState<
    "creative" | "argumentative"
  >("creative");
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [currentAgents, setCurrentAgents] = useState<Agent[]>([]);
  const [loadedQuestions, setLoadedQuestions] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  // Add start time tracking
  const startTimeRef = useRef(Date.now());

  // Add word count tracking
  const [lastFeedbackWordCount, setLastFeedbackWordCount] = useState(0);
  const WORD_COUNT_THRESHOLD = 35;

  // Add idle time tracking
  const [lastWritingTime, setLastWritingTime] = useState<number>(Date.now());
  const [hasGivenStarterFeedback, setHasGivenStarterFeedback] = useState(false);
  const IDLE_THRESHOLD = 60000; // 1 minute in milliseconds

  // ----------------------------------------------------------------
  // Utility Functions
  // ----------------------------------------------------------------

  /** Generate a stable, unique ID for each new message */
  const getUniqueMessageId = useCallback((): number => {
    const id = nextMessageIdRef.current;
    nextMessageIdRef.current += 1;
    return id;
  }, []);

  /** Format the timer display as MM:SS */
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Keep typing IDs in a ref for easy checks
  useEffect(() => {
    typingMessageIdsRef.current = typingMessageIds;
  }, [typingMessageIds]);

  // ----------------------------------------------------------------
  // Chat Container Scrolling
  // ----------------------------------------------------------------

  // If the user scrolls up, disable auto-scroll
  const handleScroll = () => {
    const chatContainer = chatContainerRef.current;
    if (!chatContainer) return;

    const isProgrammaticScroll =
      Date.now() - lastManualScrollTimeRef.current < 50;
    if (isProgrammaticScroll) return;

    const nearBottom =
      Math.abs(
        chatContainer.scrollHeight -
          chatContainer.scrollTop -
          chatContainer.clientHeight,
      ) < 150;

    if (!nearBottom) {
      setUserHasScrolled(true);
      manualScrollOverrideRef.current = true;
    } else {
      setUserHasScrolled(false);
      manualScrollOverrideRef.current = false;
    }
  };

  // ----------------------------------------------------------------
  // Timer
  // ----------------------------------------------------------------
  // If time runs out before user is done
  const autoSubmitTimeoutAnswer = useCallback(() => {
    roundEndedRef.current = true;
    setIsQuestioningEnabled(false);
    setEvaluationComplete(true);
    // Don't add the answer to chat or clear it - it will be saved when user clicks Next Question
  }, []);

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

  // ----------------------------------------------------------------
  // Question / Round Setup
  // ----------------------------------------------------------------
  const fetchQuestions = async () => {
    // In your real code, you'd load creativeTopics & argumentativeTopics from
    // an API or local JSON. We'll just set loaded = true for this example
    setLoadedQuestions(true);
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const startNewRound = useCallback(
    async (overrideSet?: "creative" | "argumentative") => {
      // Reset start time when starting new round
      startTimeRef.current = Date.now();

      // Reset idle tracking
      setLastWritingTime(Date.now());
      setHasGivenStarterFeedback(false);

      // Create a new session concurrency so partial responses won't overlap
      setFeedbackSessionId((prev) => prev + 1);

      // Reset chat states
      setMessages([]);
      setTypingMessageIds([]);
      setScratchboardContent("");
      setInput("");
      setFinalAnswer("");
      setEvaluationComplete(false);
      setUserHasScrolled(false);
      roundEndedRef.current = false;
      setTimeLeft(timerDuration);

      // Clear current agents first
      setCurrentAgents([]);

      // Decide which set we'll use (creative vs argumentative)
      const chosenSet = overrideSet ?? currentQuestionSet;
      const topicsObj =
        chosenSet === "creative" ? creativeTopics : argumentativeTopics;
      const topicKeys = Object.keys(topicsObj);
      const randomKey = topicKeys[Math.floor(Math.random() * topicKeys.length)];

      // Use fixed Claude and ChatGPT agents
      const chosenAgents: Agent[] = [
        {
          ...CLAUDE_AGENT,
          systemPrompt: CLAUDE_AGENT.systemPrompt.replace(
            "{{PROMPT}}",
            randomKey,
          ),
        },
        {
          ...CHATGPT_AGENT,
          systemPrompt: CHATGPT_AGENT.systemPrompt.replace(
            "{{PROMPT}}",
            randomKey,
          ),
        },
      ];

      setCurrentQuestion(randomKey);

      // Update state
      setCurrentAgents(chosenAgents);
      setIsQuestioningEnabled(true);
    },
    [currentQuestionSet],
  );

  useEffect(() => {
    if (loadedQuestions && !currentQuestion) {
      // Only start new round if we don't have a question yet
      startNewRound();
    }
  }, [loadedQuestions, startNewRound, currentQuestion]);

  // Move to next question or to "break" route
  const handleNextQuestion = () => {
    // Save current essay data before moving to next
    if (currentQuestion) {
      const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);
      addGroupEssay({
        questionType: currentQuestionSet,
        question: currentQuestion,
        essay: finalAnswer || "[No answer provided]",
        chatLog: messages,
        timeSpent,
      });
    }

    if (currentQuestionSet === "creative") {
      setCurrentQuestionSet("argumentative");
      startTimeRef.current = Date.now(); // Reset start time
      startNewRound("argumentative"); // This will handle everything including state updates
    } else {
      router.push("/completed");
    }
  };

  // ----------------------------------------------------------------
  // Generate Bot Responses (One After Another)
  // ----------------------------------------------------------------
  const callAgentForResponse = useCallback(
    async (agent: Agent, prompt: string): Promise<string> => {
      try {
        // Select model based on agent
        let modelId = currentModel;
        if (agent.id === "claude") {
          modelId = AI_MODELS.CLAUDE_OPUS_4_5.id;
        } else if (agent.id === "chatgpt") {
          modelId = AI_MODELS.GPT_5_2.id;
        }

        const response = await aiService.generateResponse(
          [
            {
              id: 1,
              sender: "user",
              text: prompt,
            },
          ],
          {
            systemPrompt: `${agent.systemPrompt}\n\nIMPORTANT INSTRUCTIONS:\n1. Always address the user directly using "you" instead of referring to them as "the user"\n2. Keep your responses concise and limited to 50 words or less`,
            model: modelId,
          },
        );
        return response;
      } catch (err) {
        console.error("Error calling AI for agent:", agent.name, err);
        return "(*Error calling AI*)";
      }
    },
    [currentModel],
  );

  const generateResponsesFromAllAgents = async (userMessage: string) => {
    const activeFeedback = feedbackSessionId;

    // Randomize the order in which agents respond
    const shuffledAgents = [...currentAgents].sort(() => Math.random() - 0.5);

    // Track messages as they're added to include new agent responses in subsequent prompts
    let currentMessages = [...messages];

    for (let i = 0; i < shuffledAgents.length; i++) {
      const agent = shuffledAgents[i];
      if (feedbackSessionId !== activeFeedback) break;

      const conversationSoFar = currentMessages
        .map((m) => {
          const senderName =
            m.sender === "ai"
              ? (currentAgents.find((a) => a.id === m.agentId)?.name ?? "AI")
              : "USER";
          return `${senderName}: ${m.text}`;
        })
        .join("\n");

      // Get the other agents who are also responding
      const otherAgentsInThisRound = shuffledAgents.filter(
        (a) => a.id !== agent.id,
      );
      const agentNames = otherAgentsInThisRound.map((a) => a.name).join(", ");

      let prompt: string;
      if (i === 0) {
        // First agent responds to user
        prompt = `CONVERSATION SO FAR:
${conversationSoFar}

USER just asked: "${userMessage}"

You are responding as "${agent.name}" in a group discussion with ${agentNames}. Other agents will also respond to this question, so feel free to take a specific angle or focus on particular aspects. Consider the previous conversation when forming your response.

IMPORTANT: Respond directly with your message content only. Do not include your name or a colon at the beginning of your response.`;
      } else {
        // Subsequent agents can build on what previous agents said
        const recentAgentResponses = currentMessages
          .slice(-i) // Get the most recent agent responses from this round
          .filter((m) => m.sender === "ai")
          .map((m) => {
            const agentName =
              currentAgents.find((a) => a.id === m.agentId)?.name ?? "AI";
            return `${agentName}: ${m.text}`;
          })
          .join("\n");

        prompt = `CONVERSATION SO FAR:
${conversationSoFar}

USER just asked: "${userMessage}"

OTHER AGENTS IN THIS ROUND HAVE ALREADY RESPONDED:
${recentAgentResponses}

You are "${agent.name}". Now it's your turn to respond. You can:
- Build on what other agents have said
- Offer a different perspective
- Add complementary ideas
- Respectfully disagree and provide alternatives
- Connect ideas from multiple agents

Make your response feel like part of a natural group discussion where ideas flow together.

IMPORTANT: Respond directly with your message content only. Do not include your name or a colon at the beginning of your response.`;
      }

      const aiResponseText = await callAgentForResponse(agent, prompt);
      if (feedbackSessionId !== activeFeedback) break;

      // Clean up response text - remove leading colons or agent names
      const cleanedResponse = aiResponseText
        .replace(/^[^:]*:\s*/, "") // Remove "AgentName: " pattern at start
        .replace(/^:\s*/, "") // Remove standalone colon at start
        .trim();

      const messageId = getUniqueMessageId();
      const newMessage = {
        id: messageId,
        sender: "ai" as const,
        text: cleanedResponse,
        agentId: agent.id,
        timestamp: new Date().toISOString(),
      };

      // Add to both state and our tracking array
      setMessages((prev) => [...prev, newMessage]);
      currentMessages = [...currentMessages, newMessage];

      setTypingMessageIds((prev) => [...prev, messageId]);
      setTimeout(() => {
        setTypingMessageIds((prev) => prev.filter((id) => id !== messageId));
      }, 1000);

      // Slightly longer delay between agents to make the conversation feel more natural
      await new Promise((res) => setTimeout(res, 800));
    }
  };

  // ----------------------------------------------------------------
  // User Interaction
  // ----------------------------------------------------------------
  const handleUserQuestion = async () => {
    if (!input.trim()) return;

    setFeedbackSessionId((prev) => prev + 1);

    const userMsg: Message = {
      id: getUniqueMessageId(),
      sender: "user",
      text: input,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    forceScrollToBottomRef.current = true;
    setTimeout(() => scrollToBottom(true), 100);

    await generateResponsesFromAllAgents(userMsg.text!);
  };

  const getWordCount = (text: string) =>
    text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;

  const triggerAutomaticFeedback = async (text: string) => {
    if (roundEndedRef.current) return;

    setFeedbackSessionId((prev) => prev + 1);

    // Randomize order for more natural feedback flow
    const shuffledAgents = [...currentAgents].sort(() => Math.random() - 0.5);
    let currentMessages = [...messages];

    for (let i = 0; i < shuffledAgents.length; i++) {
      const agent = shuffledAgents[i];

      let prompt: string;
      if (i === 0) {
        // First agent provides initial feedback
        prompt = `Please provide brief, constructive feedback on what has been written so far: "${text}". Other agents will also provide feedback, so focus on your unique perspective as "${agent.name}".

IMPORTANT: Respond directly with your feedback content only. Do not include your name or a colon at the beginning of your response. Limit your response to 50 words or less.`;
      } else {
        // Subsequent agents can reference previous feedback
        const recentFeedback = currentMessages
          .slice(-i)
          .filter((m) => m.sender === "ai")
          .map((m) => {
            const agentName =
              currentAgents.find((a) => a.id === m.agentId)?.name ?? "AI";
            return `${agentName}: ${m.text}`;
          })
          .join("\n");

        prompt = `The user has written: "${text}"

OTHER AGENTS HAVE ALREADY PROVIDED FEEDBACK:
${recentFeedback}

As "${agent.name}", provide your own brief, constructive feedback. You can build on what others have said, offer a different angle, or add complementary suggestions. Keep it concise and helpful.

IMPORTANT: Respond directly with your feedback content only. Do not include your name or a colon at the beginning of your response. Limit your response to 50 words or less.`;
      }

      const aiResponseText = await callAgentForResponse(agent, prompt);

      // Clean up response text - remove leading colons or agent names
      const cleanedResponse = aiResponseText
        .replace(/^[^:]*:\s*/, "") // Remove "AgentName: " pattern at start
        .replace(/^:\s*/, "") // Remove standalone colon at start
        .trim();

      const messageId = getUniqueMessageId();
      const newMessage = {
        id: messageId,
        sender: "ai" as const,
        text: cleanedResponse,
        agentId: agent.id,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, newMessage]);
      currentMessages = [...currentMessages, newMessage];

      setTypingMessageIds((prev) => [...prev, messageId]);
      setTimeout(() => {
        setTypingMessageIds((prev) => prev.filter((id) => id !== messageId));
      }, 1000);

      await new Promise((res) => setTimeout(res, 400));
    }
  };

  const triggerStarterFeedback = useCallback(async () => {
    if (roundEndedRef.current) return;

    setFeedbackSessionId((prev) => prev + 1);

    // Randomize order for more natural discussion flow
    const shuffledAgents = [...currentAgents].sort(() => Math.random() - 0.5);
    let currentMessages = [...messages];

    for (let i = 0; i < shuffledAgents.length; i++) {
      const agent = shuffledAgents[i];
      const otherAgentsInThisRound = shuffledAgents.filter(
        (a) => a.id !== agent.id,
      );
      const agentNames = otherAgentsInThisRound.map((a) => a.name).join(", ");

      let prompt: string;
      if (i === 0) {
        // First agent starts the discussion
        prompt = `The user is looking at the writing prompt: "${currentQuestion}". You are "${agent.name}" in a group discussion with ${agentNames}. Start a collaborative discussion by providing encouraging suggestions for how to approach this prompt and get started writing. Other agents will build on your ideas.

IMPORTANT: Respond directly with your suggestions content only. Do not include your name or a colon at the beginning of your response.`;
      } else {
        // Subsequent agents can build on previous suggestions
        const previousSuggestions = currentMessages
          .slice(-i)
          .filter((m) => m.sender === "ai")
          .map((m) => {
            const agentName =
              currentAgents.find((a) => a.id === m.agentId)?.name ?? "AI";
            return `${agentName}: ${m.text}`;
          })
          .join("\n");

        prompt = `The writing prompt is: "${currentQuestion}"

OTHER AGENTS HAVE ALREADY SHARED IDEAS:
${previousSuggestions}

As "${agent.name}", add your own encouraging suggestions for approaching this prompt. You can build on what others have said, offer complementary strategies, or suggest different angles to consider. Keep the collaborative spirit going!

IMPORTANT: Respond directly with your suggestions content only. Do not include your name or a colon at the beginning of your response.`;
      }

      const aiResponseText = await callAgentForResponse(agent, prompt);

      // Clean up response text - remove leading colons or agent names
      const cleanedResponse = aiResponseText
        .replace(/^[^:]*:\s*/, "") // Remove "AgentName: " pattern at start
        .replace(/^:\s*/, "") // Remove standalone colon at start
        .trim();

      const messageId = getUniqueMessageId();
      const newMessage = {
        id: messageId,
        sender: "ai" as const,
        text: cleanedResponse,
        agentId: agent.id,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, newMessage]);
      currentMessages = [...currentMessages, newMessage];

      setTypingMessageIds((prev) => [...prev, messageId]);
      setTimeout(() => {
        setTypingMessageIds((prev) => prev.filter((id) => id !== messageId));
      }, 1000);

      await new Promise((res) => setTimeout(res, 400));
    }
  }, [
    currentAgents,
    currentQuestion,
    getUniqueMessageId,
    callAgentForResponse,
    messages,
  ]);

  useEffect(() => {
    if (roundEndedRef.current || hasGivenStarterFeedback) return;

    const checkIdleInterval = setInterval(() => {
      const currentTime = Date.now();
      const currentWordCount = getWordCount(finalAnswer);

      // Only trigger starter feedback if user has written at least something (more than just whitespace)
      if (
        currentWordCount < WORD_COUNT_THRESHOLD &&
        currentTime - lastWritingTime >= IDLE_THRESHOLD &&
        finalAnswer.trim().length > 0 // Only trigger if user has written some content
      ) {
        triggerStarterFeedback();
        setHasGivenStarterFeedback(true);
      }
    }, 5000);

    return () => clearInterval(checkIdleInterval);
  }, [
    lastWritingTime,
    finalAnswer,
    hasGivenStarterFeedback,
    triggerStarterFeedback,
  ]);

  const handleFinalAnswerChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const newText = e.target.value;
    setFinalAnswer(newText);
    setLastWritingTime(Date.now());

    const currentWordCount = getWordCount(newText);
    // Only trigger automatic feedback if there's actual content and it meets the threshold
    if (
      currentWordCount >= lastFeedbackWordCount + WORD_COUNT_THRESHOLD &&
      newText.trim().length > 0
    ) {
      setLastFeedbackWordCount(currentWordCount);
      triggerAutomaticFeedback(newText);
    }
  };

  useEffect(() => {
    if (timeLeft === 180 && !finalAnswer.trim()) {
      setShowWarning(true);
    }
  }, [timeLeft, finalAnswer]);

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------
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
      {/* Left Panel: Writing Prompt & User Text */}
      <div className="w-1/2 pr-2 flex flex-col h-full overflow-hidden">
        {/* Writing Prompt with Timer */}
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

        {/* Essay Box */}
        <div className="flex flex-col bg-white bg-opacity-15 rounded-md p-4 mb-4 h-full border-2 border-blue-400 shadow-lg">
          <h3 className="text-xl text-white font-semibold mb-2">Your Essay</h3>
          <div className="flex grow flex-col space-y-3">
            <textarea
              value={finalAnswer}
              onChange={handleFinalAnswerChange}
              placeholder="Write your response here…"
              disabled={timeLeft === 0}
              className={`w-full grow bg-white bg-opacity-10 text-white border border-gray-600 rounded-md px-3 py-3 text-lg ${
                timeLeft === 0 ? "opacity-50 cursor-not-allowed" : ""
              }`}
            />
          </div>
        </div>
      </div>

      {/* Right Panel: Chat */}
      <div className="w-1/2 pl-2 flex flex-col h-full">
        <div className="flex-1 bg-white bg-opacity-10 rounded-md flex flex-col overflow-hidden">
          {/* Agent Avatars */}
          <div className="bg-black bg-opacity-30 p-2 flex space-x-4">
            {currentAgents.map((agent) => (
              <div key={agent.id} className="relative flex items-center group">
                <Image
                  src={agent.avatar}
                  alt={agent.name}
                  width={40}
                  height={40}
                  className="rounded-full border-2 border-white cursor-pointer"
                />
                <span className="ml-2 text-white text-sm">{agent.name}</span>

                {/* Tooltip */}
                <div className="absolute left-0 top-12 w-64 bg-gray-900 text-white text-sm rounded-lg shadow-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-50">
                  {agent.introMessage}
                </div>
              </div>
            ))}
          </div>

          {/* Messages */}
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
                {/* AI Avatar (if sender === ai) */}
                {msg.sender === "ai" && (
                  <div className="mr-2 flex-shrink-0">
                    <Image
                      src={
                        currentAgents.find((a) => a.id === msg.agentId)
                          ?.avatar || "/logic_avatar.png"
                      }
                      alt={
                        currentAgents.find((a) => a.id === msg.agentId)?.name ||
                        "AI"
                      }
                      width={40}
                      height={40}
                      className="rounded-full border-2 border-white"
                    />
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={`max-w-[75%] rounded-lg p-3 ${
                    msg.sender === "user"
                      ? "bg-blue-600 text-white"
                      : msg.sender === "system"
                        ? "bg-purple-700 text-white"
                        : "bg-white bg-opacity-10 text-white"
                  }`}
                >
                  {/* Bot name above message */}
                  {msg.sender === "ai" && (
                    <div className="text-sm text-gray-300 mb-1 font-bold">
                      {currentAgents.find((a) => a.id === msg.agentId)?.name ??
                        "AI"}
                    </div>
                  )}

                  {/* Typewriter if still typing */}
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

          {/* Input for user questions */}
          {isQuestioningEnabled && (
            <div className="p-3 bg-black bg-opacity-30">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask for help or advice. E.g., you may write “Help me brainstorm ideas….”"
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

          {/* Next Question Button */}
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
