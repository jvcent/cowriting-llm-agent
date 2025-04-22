import { FeedbackData, UserProgress } from "@/types";

export interface UserData {
  userId: string;
  flowStage?: string;
  lessonType?: string;
  lessonQuestionIndex?: number;
}

export interface UserResponse {
  success: boolean;
  error?: string;
  data?: UserData;
}

export const UserService = {
  async createOrUpdateUser(userData: UserData): Promise<UserResponse> {
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to save user data");
      }

      return data;
    } catch (error) {
      console.error("Error saving user data:", error);
      throw error;
    }
  },

  async getUser(userId: string): Promise<UserData | null> {
    try {
      const response = await fetch(`/api/users?userId=${userId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch user");
      }

      return data.data;
    } catch (error) {
      console.error("Error fetching user:", error);
      return null;
    }
  },

  async saveUserFeedback(feedbackData: FeedbackData): Promise<void> {
    // Implementation here
    console.log("Saving feedback:", feedbackData);
  },

  async saveUserProgress(progress: UserProgress): Promise<void> {
    // Implementation here
    console.log("Saving progress:", progress);
  },
};

export default UserService;
