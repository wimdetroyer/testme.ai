'use client'

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import OpenAI from "openai";
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/types/src/display/api';

enum Step {
  API_KEY = 'API_KEY',
  TEXT_INPUT = 'TEXT_INPUT',
  GENERATING_TEST = 'GENERATING_TEST',
  TEST_GENERATED = 'TEST_GENERATED',
  ANSWERING_QUESTIONS = 'ANSWERING_QUESTIONS',
  FEEDBACK = 'FEEDBACK'
}

export default function TestMeApp() {
  const [step, setStep] = useState<Step>(Step.API_KEY);
  const [apiKey, setApiKey] = useState('');
  const [inputText, setInputText] = useState('');
  const [questions, setQuestions] = useState([]);
  const [userAnswers, setUserAnswers] = useState({});
  const [feedback, setFeedback] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [startPage, setStartPage] = useState<number>(1);
  const [endPage, setEndPage] = useState<number>(1);

  useEffect(() => {
    const storedApiKey = localStorage.getItem('openai_api_key');
    if (storedApiKey) {
      setApiKey(storedApiKey);
      setStep(Step.TEXT_INPUT);
    }
  }, []);

  const handleApiKeySubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (apiKey.trim()) {
      localStorage.setItem('openai_api_key', apiKey);
      setStep(Step.TEXT_INPUT);
    } else {
      alert('Please enter a valid API key');
    }
  };

  const callOpenAI = async (messages: { role: string; content: string; }[]) => {
    const openai = new OpenAI({ apiKey , dangerouslyAllowBrowser: true});

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
    });

    return completion.choices[0].message.content;
  };

  const generateTest = async () => {
    setIsLoading(true);
    setStep(Step.GENERATING_TEST);
    try {
      const result = await callOpenAI([
        {role: "system", content: "You are a helpful assistant that generates test questions based on given text."},
        {role: "user", content: `Generate 1 or more (depending on length of text)open-ended questions (relatively small in size) with short answers and based on the following text. The questions should require minimal prompting and test understanding of the key concepts. Only return the questions, no need for answers or explanations:\n\n${inputText}`}
      ]);

      const generatedQuestions = result.split('\n').filter(q => q.trim() !== '');
      setQuestions(generatedQuestions);
      setStep(Step.TEST_GENERATED);
    } catch (error) {
      console.error('Error generating questions:', error);
      alert('Error generating questions. Please check your API key and try again.');
      setStep(Step.TEXT_INPUT);
    } finally {
      setIsLoading(false);
    }
  };

  const checkAnswers = async () => {
    setIsLoading(true);
    try {
      const feedback = await Promise.all(questions.map(async (question, index) => {
        const result = await callOpenAI([
          {role: "system", content: "You are a helpful assistant that evaluates answers to test questions based on given text."},
          {role: "user", content: `Based on the following text:\n\n${inputText}\n\nQuestion: ${question}\nStudent's answer: ${userAnswers[index]}\n\nEvaluate the student's answer. Provide brief feedback on what they got right and what they might have missed. Be encouraging but point out any inaccuracies. You're talking to the student directly, so use a conversational tone. Use bullet points to list the key points and feedback. you can structure the reply as HTML. Just give the evualation, nothing else.`}
        ]);

        return {
          question,
          answer: userAnswers[index],
          feedback: result
        };
      }));

      setFeedback(feedback);
      setStep(Step.FEEDBACK);
    } catch (error) {
      console.error('Error checking answers:', error);
      alert('Error checking answers. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerChange = (index, value) => {
    setUserAnswers(prev => ({ ...prev, [index]: value }));
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPdfFile(file);
    }
  };

  const extractTextFromPdf = async () => {
    if (!pdfFile) return;

    const fileReader = new FileReader();
    fileReader.onload = async () => {
      const typedArray = new Uint8Array(fileReader.result as ArrayBuffer);
      const pdf = await pdfjsLib.getDocument(typedArray).promise;
      let extractedText = '';

      for (let i = startPage; i <= endPage; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => (item as any).str).join(' ');
        extractedText += `\n${pageText}`;
      }

      setInputText(extractedText);
    };

    fileReader.readAsArrayBuffer(pdfFile);
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">TestMe.ai</h1>
      
      {showIntro && (
        <Alert className="mb-4" variant="info">
          <AlertTitle>Welcome to TestMe.ai</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              This application is inspired by the podcast of Andrew Huberman, specifically the episode "Optimal Protocols for Studying & Learning". 
              In this episode, Andrew discusses science-supported protocols to optimize your depth and rate of learning of material and skills. 
              He explains the neurobiology of learning and neuroplasticity and how correctly timed, self-directed test-taking can be leveraged to improve learning and prevent forgetting.
            </p>
            <p className="mb-2">
              By using this application, you can generate test questions based on any text you provide, answer them, and receive feedback to enhance your learning experience.
            </p>
            <Button onClick={() => setShowIntro(false)}>Close</Button>
          </AlertDescription>
        </Alert>
      )}

      {step === Step.API_KEY && (
        <form onSubmit={handleApiKeySubmit} className="mb-4">
          <Input
            type="text"
            placeholder="Enter your OpenAI API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full mb-2"
          />
          <Button type="submit">Submit API Key</Button>
        </form>
      )}

      {step === Step.TEXT_INPUT && (
        <>
          <Textarea
            placeholder="Enter your text here"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full h-40 mb-4"
          />
          <div className="mb-4">
            <Input type="file" accept="application/pdf" onChange={handlePdfUpload} className="mb-2" />
            <div className="flex space-x-2">
              <Input
                type="number"
                placeholder="Start Page"
                value={startPage}
                onChange={(e) => setStartPage(parseInt(e.target.value))}
                className="w-1/2"
              />
              <Input
                type="number"
                placeholder="End Page"
                value={endPage}
                onChange={(e) => setEndPage(parseInt(e.target.value))}
                className="w-1/2"
              />
            </div>
            <Button onClick={extractTextFromPdf} disabled={!pdfFile}>Extract Text from PDF</Button>
          </div>
          <Button onClick={generateTest} disabled={isLoading}>Generate Test</Button>
        </>
      )}

      {step === Step.GENERATING_TEST && (
        <Alert>
          <AlertTitle>Generating Test</AlertTitle>
          <AlertDescription>Please wait while we create your test questions...</AlertDescription>
        </Alert>
      )}

      {step === Step.TEST_GENERATED && (
        <>
          <Alert className="mb-4">
            <AlertTitle>Test Generated</AlertTitle>
            <AlertDescription>Your test is ready. Click the button when you're done studying.</AlertDescription>
          </Alert>
          <Button onClick={() => setStep(Step.ANSWERING_QUESTIONS)}>Done Studying</Button>
        </>
      )}

      {step === Step.ANSWERING_QUESTIONS && (
        <>
          {questions.map((q, index) => (
            <div key={index} className="mb-4">
              <p className="font-semibold">{q}</p>
              <Input
                placeholder="Your answer"
                value={userAnswers[index] || ''}
                onChange={(e) => handleAnswerChange(index, e.target.value)}
                className="w-full"
              />
            </div>
          ))}
          <Button onClick={checkAnswers} disabled={isLoading}>Check Answers</Button>
        </>
      )}

      {step === Step.FEEDBACK && (
        <div>
          <h2 className="text-xl font-bold mb-4">Feedback</h2>
          {feedback.map((item, index) => (
            <div key={index} className="mb-4">
              <p className="font-semibold">{item.question}</p>
              <p>Your answer: {item.answer}</p>
              <div dangerouslySetInnerHTML={{ __html: item.feedback }} />
            </div>
          ))}
          <Button onClick={() => setStep(Step.TEXT_INPUT)}>Start Over</Button>
        </div>
      )}

      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-4 rounded">Loading...</div>
        </div>
      )}
    </div>
  );
}