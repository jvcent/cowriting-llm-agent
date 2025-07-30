import { NextResponse } from "next/server";
import admin from "firebase-admin";

// Initialize Firebase Admin SDK if it hasn't been already
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Replace newlines in the private key
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

// Get Firestore instance
const db = admin.firestore();

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Add a timestamp to the data
    const dataToSubmit = {
      ...data,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      // Add a unique identifier or session ID if needed
      sessionId: Math.random().toString(36).substring(2, 15),
    };

    // Add a new document to the writing_data collection
    const docRef = await db.collection("writing_data").add(dataToSubmit);
    
    return NextResponse.json({
      success: true,
      message: "Data submitted successfully",
      documentId: docRef.id,
    });
  } catch (error) {
    console.error("Error submitting data:", error);
    
    return NextResponse.json(
      {
        success: false,
        message: "Error submitting data",
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
