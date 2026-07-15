import { collection, doc } from "firebase/firestore";
import { db } from "../firebase";

export const tournamentStateDoc = () => doc(db, "tournament", "state");
export const participantsCollection = () => collection(db, "participants");
export const participantDoc = (id: string) => doc(db, "participants", id);
export const turnsCollection = () => collection(db, "turns");
export const turnDoc = (id: string) => doc(db, "turns", id);
export const surveyQuestionsCollection = () => collection(db, "surveyQuestions");
export const surveyQuestionDoc = (id: string) => doc(db, "surveyQuestions", id);
export const surveyResponsesCollection = () => collection(db, "surveyResponses");
export const surveyResponseDoc = (id: string) => doc(db, "surveyResponses", id);
