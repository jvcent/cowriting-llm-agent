"use client";

import React, { useState, useEffect } from "react";
import { useFlow } from "@/context/FlowContext";

type SurveyAnswers = {
  confidence: string;
  inputHelpfulness: string;
  ideaPrompting: string;
  overwhelmed: string;
  prosAndCons: string;
  age: string;
  gender: string;
  genderOther: string;
  isEnglishFirstLanguage: string;
  writingPromptsCount: string;
};

export default function CompletedPage() {
  const { saveSurveyData, soloEssays, singleEssays, groupEssays } = useFlow();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const [surveyAnswers, setSurveyAnswers] = useState<SurveyAnswers>({
    confidence: "",
    inputHelpfulness: "",
    ideaPrompting: "",
    overwhelmed: "",
    prosAndCons: "",
    age: "18",
    gender: "",
    genderOther: "",
    isEnglishFirstLanguage: "",
    writingPromptsCount: "",
  });

  // Log all saved data when component mounts
  useEffect(() => {
    console.log("=== Current Saved Data ===");
    console.log("Solo Essays:", soloEssays);
    console.log("Single Essays:", singleEssays);
    console.log("Group Essays:", groupEssays);
    console.log("=====================");
  }, [soloEssays, singleEssays, groupEssays]);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLSelectElement | HTMLTextAreaElement | HTMLInputElement
    >,
  ): void => {
    const { name, value } = e.target;
    setSurveyAnswers((prev) => ({
      ...prev,
      [name]: value,
    }));
  };
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Log data before submission
      console.log("=== Submitting Data ===");
      console.log("Survey Answers:", surveyAnswers);
      console.log("Solo Essays:", soloEssays);
      console.log("Single Essays:", singleEssays);
      console.log("Group Essays:", groupEssays);
      console.log("=====================");

      // First save survey data to flow context
      saveSurveyData(surveyAnswers);

      // Prepare data for API submission
      const dataToSubmit = {
        soloEssays,
        singleEssays,
        groupEssays,
        surveyAnswers,
      };

      // Submit data to API endpoint that handles Firebase writing
      const response = await fetch("/api/submit-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dataToSubmit),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Error submitting data");
      }

      console.log("Document written with ID: ", result.documentId);

      setHasSubmitted(true);
    } catch (error) {
      console.error("Error submitting data:", error);
      alert("There was an error submitting your data. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2D0278] to-[#0A001D] p-8">
      <div className="max-w-4xl mx-auto bg-white bg-opacity-10 p-8 rounded-xl text-white">
        <h1 className="text-4xl font-bold mb-6">Completed!</h1>

        {!hasSubmitted ? (
          <>
            <p className="mb-6">
              Thank you for participating in this study. Before you go, please
              complete this brief survey:
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Question 1 */}
              <div>
                <label className="block mb-2">
                  How confident are you that you
                  could produce high-quality piece of writing on similar
                  assignments without assistance?
                </label>
                <select
                  name="confidence"
                  value={surveyAnswers.confidence}
                  onChange={handleInputChange}
                  required
                  // Changed classes to bg-gray-800 text-white
                  className="w-full p-3 rounded border border-gray-500 bg-gray-800 text-white"
                >
                  <option value="">Select an option</option>
                  <option value="not_confident">Not confident</option>
                  <option value="slightly">Slightly</option>
                  <option value="confident">Confident</option>
                  <option value="very_confident">Very confident</option>
                </select>
              </div>

              {/* Question 2 */}
              <div>
                <label className="block mb-2">
                  How helpful was the support provided to you during writing?
                </label>
                <select
                  name="inputHelpfulness"
                  value={surveyAnswers.inputHelpfulness}
                  onChange={handleInputChange}
                  required
                  className="w-full p-3 rounded border border-gray-500 bg-gray-800 text-white"
                >
                  <option value="">Select an option</option>
                  <option value="not_helpful">Not helpful</option>
                  <option value="slightly">Slightly</option>
                  <option value="helpful">Helpful</option>
                  <option value="very_helpful">Very helpful</option>
                </select>
              </div>

              {/* Question 3 */}
              <div>
                <label>Rate how well you agree with this statement :</label>
                <label className="block mb-2">
                  The inputs I saw prompted me to consider ideas I wouldn&apos;t
                  have generated on my own.
                </label>
                <select
                  name="ideaPrompting"
                  value={surveyAnswers.ideaPrompting}
                  onChange={handleInputChange}
                  required
                  className="w-full p-3 rounded border border-gray-500 bg-gray-800 text-white"
                >
                  <option value="">Select an option</option>
                  <option value="strongly_disagree">Strongly disagree</option>
                  <option value="disagree">Disagree</option>
                  <option value="agree">Agree</option>
                  <option value="strongly_agree">Strongly agree</option>
                </select>
              </div>

              {/* Question 4 */}
              <div>
                <label>Rate how well you agree with this statement :</label>
                <label className="block mb-2">
                  I felt overwhelmed or confused by the amount of input during
                  the writing task.
                </label>
                <select
                  name="overwhelmed"
                  value={surveyAnswers.overwhelmed}
                  onChange={handleInputChange}
                  required
                  className="w-full p-3 rounded border border-gray-500 bg-gray-800 text-white"
                >
                  <option value="">Select an option</option>
                  <option value="not_at_all">Not at all</option>
                  <option value="slightly">Slightly</option>
                  <option value="moderately">Moderately</option>
                  <option value="very">Very</option>
                </select>
              </div>

              {/* Question 5 - Open Ended */}
              <div>
                <label className="block mb-2">
                  If you received any assistance during the writing task, please
                  describe what you found helpful and what could have been
                  improved, otherwise say that you did not receive any
                  assistance:
                </label>
                <textarea
                  name="prosAndCons"
                  value={surveyAnswers.prosAndCons}
                  onChange={handleInputChange}
                  required
                  rows={4}
                  className="w-full p-3 rounded border border-gray-500 bg-gray-800 text-white resize-none"
                  placeholder="Please share your thoughts..."
                />
              </div>

              {/* Question 6 - Writing Prompts Count */}
              <div>
                <label className="block mb-2">
                  How many essays were you asked to write?
                </label>
                <input
                  type="number"
                  name="writingPromptsCount"
                  value={surveyAnswers.writingPromptsCount}
                  onChange={handleInputChange}
                  required
                  min="0"
                  className="w-full p-3 rounded border border-gray-500 bg-gray-800 text-white"
                  placeholder="Enter the number of prompts"
                />
              </div>

              {/* Demographic Questions */}
              <div>
                <label className="block mb-2">What is your age?</label>
                <div className="flex items-center space-x-4">
                  <input
                    type="range"
                    name="age"
                    min="18"
                    max="100"
                    value={surveyAnswers.age}
                    onChange={handleInputChange}
                    required
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-white min-w-[3rem]">
                    {surveyAnswers.age}
                  </span>
                </div>
              </div>

              <div>
                <label className="block mb-2">What is your gender?</label>
                <select
                  name="gender"
                  value={surveyAnswers.gender}
                  onChange={handleInputChange}
                  required
                  className="w-full p-3 rounded border border-gray-500 bg-gray-800 text-white mb-2"
                >
                  <option value="">Select an option</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other (please specify)</option>
                  <option value="prefer_not_to_answer">
                    Prefer not to answer
                  </option>
                </select>
                {surveyAnswers.gender === "other" && (
                  <div className="mt-2">
                    <input
                      type="text"
                      name="genderOther"
                      value={surveyAnswers.genderOther}
                      onChange={handleInputChange}
                      required
                      placeholder="Please specify your gender"
                      className="w-full p-3 rounded border border-gray-500 bg-gray-800 text-white"
                    />
                    {!surveyAnswers.genderOther && (
                      <p className="text-red-400 text-sm mt-1">
                        Please specify your gender
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block mb-2">
                  Is English your first language?
                </label>
                <select
                  name="isEnglishFirstLanguage"
                  value={surveyAnswers.isEnglishFirstLanguage}
                  onChange={handleInputChange}
                  required
                  className="w-full p-3 rounded border border-gray-500 bg-gray-800 text-white"
                >
                  <option value="">Select an option</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-6 py-3 rounded-lg ${
                  isSubmitting
                    ? "bg-gray-500 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                } text-white font-medium flex items-center justify-center`}
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Submitting...
                  </>
                ) : (
                  "Submit Survey & Complete"
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-16 w-16 text-green-500 mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <h2 className="text-2xl font-bold mb-4">Thank You!</h2>
            <p className="mb-6">
              Your responses have been successfully submitted.
            </p>
            <p>You may close this window now.</p>
          </div>
        )}
      </div>
    </div>
  );
}
