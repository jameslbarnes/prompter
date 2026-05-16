// Test for questionGeneration utility functions
const { buildConversationHistory } = require('../../../server/utils/questionGeneration');

describe('buildConversationHistory', () => {
    describe('thinking block handling', () => {
        it('should pass thinking blocks unmodified without adding custom signatures', () => {
            // Create a mock thinking block as Claude would return it
            const mockThinkingBlock = {
                type: "thinking",
                thinking: "Let me analyze the user's response about their experience...",
                // Claude's thinking blocks may or may not have a signature
                // If they do, it should be preserved exactly
            };

            const assistantQuestions = [
                {
                    text: "Can you tell me about your experience?",
                    thinkingBlock: mockThinkingBlock
                }
            ];

            const interviewResponses = [
                "I had a great time working on the project."
            ];

            const messages = buildConversationHistory({
                assistantQuestions,
                interviewResponses,
                isFollowUp: true
            });

            // Find the assistant message
            const assistantMessage = messages.find(msg => msg.role === 'assistant');

            expect(assistantMessage).toBeDefined();
            expect(Array.isArray(assistantMessage.content)).toBe(true);

            // The thinking block should be the first item in the content array
            const thinkingBlockInMessage = assistantMessage.content[0];

            // CRITICAL: The thinking block should be EXACTLY the same object reference
            expect(thinkingBlockInMessage).toBe(mockThinkingBlock);

            // It should NOT have a custom signature added
            expect(thinkingBlockInMessage.signature).toBeUndefined();
        });

        it('should preserve existing signatures in thinking blocks', () => {
            // Mock thinking block with an existing signature (as Claude would provide)
            const mockThinkingBlock = {
                type: "thinking",
                thinking: "Analyzing the response...",
                signature: "claude_internal_signature_xyz123" // Existing signature from Claude
            };

            const assistantQuestions = [
                {
                    text: "What did you think about that?",
                    thinkingBlock: mockThinkingBlock
                }
            ];

            const interviewResponses = [
                "It was very insightful."
            ];

            const messages = buildConversationHistory({
                assistantQuestions,
                interviewResponses,
                isFollowUp: true
            });

            const assistantMessage = messages.find(msg => msg.role === 'assistant');
            const thinkingBlockInMessage = assistantMessage.content[0];

            // Should preserve the exact signature from Claude
            expect(thinkingBlockInMessage.signature).toBe("claude_internal_signature_xyz123");

            // Should NOT replace it with a custom one
            expect(thinkingBlockInMessage.signature).not.toMatch(/^thinking_\d+_/);
        });

        it('should handle assistant questions without thinking blocks', () => {
            const assistantQuestions = [
                {
                    text: "Tell me more about that.",
                    thinkingBlock: null
                }
            ];

            const interviewResponses = [
                "Sure, here's more detail..."
            ];

            const messages = buildConversationHistory({
                assistantQuestions,
                interviewResponses,
                isFollowUp: true
            });

            const assistantMessage = messages.find(msg => msg.role === 'assistant');

            // Should just be text, not an array
            expect(typeof assistantMessage.content).toBe('string');
            expect(assistantMessage.content).toBe("Tell me more about that.");
        });

        it('should handle multiple rounds of conversation', () => {
            const mockThinkingBlock1 = {
                type: "thinking",
                thinking: "First thinking block"
            };

            const mockThinkingBlock2 = {
                type: "thinking",
                thinking: "Second thinking block"
            };

            const assistantQuestions = [
                {
                    text: "First question?",
                    thinkingBlock: mockThinkingBlock1
                },
                {
                    text: "Second question?",
                    thinkingBlock: mockThinkingBlock2
                }
            ];

            const interviewResponses = [
                "First answer",
                "Second answer"
            ];

            const messages = buildConversationHistory({
                assistantQuestions,
                interviewResponses,
                isFollowUp: true
            });

            // Should have 4 messages: assistant, user, assistant, user
            expect(messages).toHaveLength(4);

            // Check first assistant message
            const firstAssistant = messages[0];
            expect(firstAssistant.content[0]).toBe(mockThinkingBlock1);

            // Check second assistant message
            const secondAssistant = messages[2];
            expect(secondAssistant.content[0]).toBe(mockThinkingBlock2);

            // Neither should have custom signatures
            expect(mockThinkingBlock1.signature).toBeUndefined();
            expect(mockThinkingBlock2.signature).toBeUndefined();
        });

        it('should apply cache_control to the last user response', () => {
            const assistantQuestions = [
                { text: "Question?", thinkingBlock: null }
            ];

            const interviewResponses = [
                "Answer here"
            ];

            const messages = buildConversationHistory({
                assistantQuestions,
                interviewResponses,
                isFollowUp: true
            });

            const userMessage = messages.find(msg => msg.role === 'user');

            // Last user message should have cache_control
            expect(Array.isArray(userMessage.content)).toBe(true);
            expect(userMessage.content[0].cache_control).toEqual({ type: "ephemeral" });
        });
    });

    describe('edge cases', () => {
        it('should handle legacy string format for questions', () => {
            const assistantQuestions = [
                "This is a legacy string question"
            ];

            const interviewResponses = [
                "Response to legacy question"
            ];

            const messages = buildConversationHistory({
                assistantQuestions,
                interviewResponses,
                isFollowUp: true
            });

            const assistantMessage = messages.find(msg => msg.role === 'assistant');
            expect(assistantMessage.content).toBe("This is a legacy string question");
        });

        it('should return empty array when not a follow-up', () => {
            const messages = buildConversationHistory({
                assistantQuestions: ["Question?"],
                interviewResponses: ["Answer"],
                isFollowUp: false
            });

            expect(messages).toHaveLength(0);
        });

        it('should handle empty conversation history', () => {
            const messages = buildConversationHistory({
                assistantQuestions: [],
                interviewResponses: [],
                isFollowUp: true
            });

            expect(messages).toHaveLength(0);
        });
    });
});
