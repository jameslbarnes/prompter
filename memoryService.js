// Environment variables should already be loaded by server.js

const { MemoryClient } = require('mem0ai');
const neo4j = require('neo4j-driver');
const { QdrantClient } = require('@qdrant/js-client-rest');

class InterviewMemoryService {
    constructor() {
        this.memory = null;
        this.neo4jDriver = null;
        this.qdrantClient = null;
        this.initialized = false;
        this.neo4jAvailable = false;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            // Initialize Neo4j if available (optional)
            await this.initializeNeo4j();
            // Neo4j initialization moved to separate method

            // Initialize Qdrant client
            const qdrantUrl = process.env.QDRANT_URL || 'https://your-qdrant-instance.qdrant.io';
            const qdrantApiKey = process.env.QDRANT_API_KEY || 'your-api-key';
            
            this.qdrantClient = new QdrantClient({
                url: qdrantUrl,
                apiKey: qdrantApiKey,
            });

            // Initialize mem0 with configuration
            const config = {
                apiKey: process.env.MEM0_API_KEY,
                version: "v1.1"
            };
            
            // Only use custom vector store if explicitly enabled
            if (process.env.USE_CUSTOM_VECTOR_STORE === 'true') {
                console.log('[MemoryService] Using custom Qdrant vector store');
                config.vector_store = {
                    provider: "qdrant",
                    config: {
                        collection_name: "interview_memories",
                        embedding_model_dims: 1536, // OpenAI embeddings dimension
                        client: this.qdrantClient
                    }
                };
                config.embedder = {
                    provider: "openai",
                    config: {
                        model: "text-embedding-3-small",
                        api_key: process.env.OPENAI_API_KEY
                    }
                };
            } else {
                console.log('[MemoryService] Using Mem0 managed service');
            }
            
            // Only add graph_store if Neo4j is available
            if (this.neo4jAvailable) {
                const neo4jUri = process.env.NEO4J_URI;
                const neo4jUser = process.env.NEO4J_USER;
                const neo4jPassword = process.env.NEO4J_PASSWORD;
                
                config.graph_store = {
                    provider: "neo4j",
                    config: {
                        url: neo4jUri,
                        username: neo4jUser,
                        password: neo4jPassword
                    }
                };
            }

            this.memory = new MemoryClient(config);
            this.initialized = true;
            console.log('Interview Memory Service initialized successfully');
            
            // Create necessary indexes in Neo4j if available
            if (this.neo4jAvailable) {
                await this.createNeo4jIndexes();
            }
            
        } catch (error) {
            console.error('Failed to initialize Interview Memory Service:', error);
            throw error;
        }
    }

    async initializeNeo4j() {
        try {
            const neo4jUri = process.env.NEO4J_URI;
            const neo4jUser = process.env.NEO4J_USER || 'neo4j';
            const neo4jPassword = process.env.NEO4J_PASSWORD;
            
            if (!neo4jUri || !neo4jPassword) {
                console.log('Neo4j configuration not found, continuing without graph store');
                return;
            }
            
            // Skip Neo4j if explicitly disabled
            if (process.env.DISABLE_NEO4J === 'true') {
                console.log('Neo4j explicitly disabled via DISABLE_NEO4J env var');
                return;
            }
            
            this.neo4jDriver = neo4j.driver(
                neo4jUri,
                neo4j.auth.basic(neo4jUser, neo4jPassword)
            );
            
            // Verify Neo4j connection with timeout
            const session = this.neo4jDriver.session();
            const testQuery = session.run('RETURN 1');
            const timeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Neo4j connection timeout')), 2000)
            );
            
            await Promise.race([testQuery, timeout]);
            await session.close();
            
            this.neo4jAvailable = true;
            console.log('Neo4j connection established successfully');
            
        } catch (error) {
            console.warn('Neo4j initialization failed:', error.message);
            console.warn('Continuing with limited functionality - graph queries will not be available');
            
            if (this.neo4jDriver) {
                await this.neo4jDriver.close();
                this.neo4jDriver = null;
            }
            this.neo4jAvailable = false;
        }
    }

    async createNeo4jIndexes() {
        const session = this.neo4jDriver.session();
        try {
            // Create indexes for efficient querying
            await session.run(
                'CREATE INDEX user_email_index IF NOT EXISTS FOR (u:User) ON (u.email)'
            );
            await session.run(
                'CREATE INDEX interview_id_index IF NOT EXISTS FOR (i:Interview) ON (i.id)'
            );
            await session.run(
                'CREATE INDEX session_id_index IF NOT EXISTS FOR (s:Session) ON (s.id)'
            );
            console.log('Neo4j indexes created successfully');
        } catch (error) {
            console.error('Error creating Neo4j indexes:', error);
        } finally {
            await session.close();
        }
    }

    /**
     * Add memory for an interview session
     * @param {Object} params - Parameters for adding memory
     * @param {string} params.userEmail - Email of the user (admin or guest)
     * @param {string} params.interviewId - ID of the interview template
     * @param {string} params.sessionId - Unique session ID (report ID)
     * @param {boolean} params.isAdmin - Whether the user is an admin
     * @param {Array} params.qaPairs - Array of Q&A pairs from the interview
     * @param {Object} params.metadata - Additional metadata
     */
    async addInterviewMemory({ userEmail, interviewId, sessionId, isAdmin, qaPairs, metadata = {} }) {
        if (!this.initialized) await this.initialize();

        // Validate input parameters to prevent API errors
        if (!userEmail || typeof userEmail !== 'string') {
            throw new Error('Invalid or missing userEmail');
        }
        if (!interviewId || typeof interviewId !== 'string') {
            throw new Error('Invalid or missing interviewId');
        }
        if (!sessionId || typeof sessionId !== 'string') {
            throw new Error('Invalid or missing sessionId');
        }
        if (!Array.isArray(qaPairs) || qaPairs.length === 0) {
            throw new Error('Invalid or empty qaPairs array');
        }
        
        // Validate each Q&A pair
        for (const qa of qaPairs) {
            if (!qa || typeof qa !== 'object') {
                throw new Error('Invalid Q&A pair object');
            }
            if (!qa.question || typeof qa.question !== 'string' || qa.question.trim() === '') {
                throw new Error('Invalid or empty question in Q&A pair');
            }
            if (!qa.answer || typeof qa.answer !== 'string' || qa.answer.trim() === '') {
                throw new Error('Invalid or empty answer in Q&A pair');
            }
            if (qa.timestamp && typeof qa.timestamp !== 'string') {
                throw new Error('Invalid timestamp format in Q&A pair');
            }
        }

        try {
            // Create graph relationships if Neo4j is available
            if (this.neo4jAvailable) {
                const session = this.neo4jDriver.session();
                try {
                    // Create user node in Neo4j
                    await session.run(
                        `MERGE (u:User {email: $email})
                         SET u.isAdmin = $isAdmin, u.lastActive = datetime()
                         RETURN u`,
                        { email: userEmail, isAdmin: isAdmin }
                    );

                    // Create interview session node and relationships
                    await session.run(
                        `MATCH (u:User {email: $userEmail})
                         MERGE (i:Interview {id: $interviewId})
                         MERGE (s:Session {id: $sessionId})
                         SET s.timestamp = datetime(), s.metadata = $metadata
                         MERGE (u)-[:COMPLETED]->(s)
                         MERGE (s)-[:BELONGS_TO]->(i)
                         MERGE (u)-[:PARTICIPATED_IN]->(i)`,
                        { 
                            userEmail, 
                            interviewId, 
                            sessionId,
                            metadata: JSON.stringify(metadata)
                        }
                    );
                } finally {
                    await session.close();
                }
            }

            // Process and store Q&A pairs as memories using conversation format
            const memories = [];
            for (const qa of qaPairs) {
                // Format as conversation messages like the mem0ai example
                const conversationMessages = [
                    { role: "assistant", content: qa.question }, // Interviewer asks question
                    { role: "user", content: qa.answer }         // Interviewee responds
                ];
                
                // Add memory with mem0 using conversation format with retry logic
                let memoryResult = null;
                const maxRetries = 3;
                const baseDelay = 1000; // 1 second
                
                for (let attempt = 1; attempt <= maxRetries; attempt++) {
                    try {
                        memoryResult = await this.memory.add(
                            conversationMessages,
                            {
                                user_id: userEmail,
                                metadata: {
                                    interview_id: interviewId,
                                    session_id: sessionId,
                                    question: qa.question,
                                    timestamp: qa.timestamp || new Date().toISOString(),
                                    is_admin: isAdmin
                                }
                            }
                        );
                        break; // Success, exit retry loop
                    } catch (memError) {
                        console.warn(`Memory add attempt ${attempt}/${maxRetries} failed:`, memError.message);
                        
                        if (attempt === maxRetries) {
                            // Last attempt failed, throw error
                            throw new Error(`Memory service failed after ${maxRetries} attempts: ${memError.message}`);
                        }
                        
                        // Check if this is a timeout or server error that we should retry
                        const isRetryableError = (
                            memError.message.includes('504') || 
                            memError.message.includes('timeout') ||
                            memError.message.includes('Gateway Time-out') ||
                            memError.message.includes('502') ||
                            memError.message.includes('503')
                        );
                        
                        if (!isRetryableError) {
                            // Don't retry for non-timeout errors
                            throw memError;
                        }
                        
                        // Exponential backoff delay
                        const delay = baseDelay * Math.pow(2, attempt - 1);
                        console.log(`Retrying memory add in ${delay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
                memories.push(memoryResult);

                // Store Q&A relationship in Neo4j if available
                if (this.neo4jAvailable) {
                    const session = this.neo4jDriver.session();
                    try {
                        await session.run(
                            `MATCH (s:Session {id: $sessionId})
                             CREATE (q:QAPair {
                                 question: $question,
                                 answer: $answer,
                                 timestamp: $timestamp,
                                 memory_id: $memoryId
                             })
                             MERGE (s)-[:CONTAINS]->(q)`,
                            {
                                sessionId,
                                question: qa.question,
                                answer: qa.answer,
                                timestamp: qa.timestamp || new Date().toISOString(),
                                memoryId: memoryResult.id || ''
                            }
                        );
                    } finally {
                        await session.close();
                    }
                }
            }
            console.log(`Added ${memories.length} memories for session ${sessionId}`);
            return memories;

        } catch (error) {
            console.error('Error adding interview memory:', error);
            throw error;
        }
    }

    /**
     * Get user memories
     * @param {string} userEmail - Email of the user
     * @param {string} interviewId - Optional interview ID to filter by
     * @param {string} query - Optional search query
     * @param {number} limit - Number of memories to return
     */
    async getUserMemories(userEmail, interviewId = null, query = null, limit = 10) {
        if (!this.initialized) await this.initialize();

        try {
            let filters = {
                "AND": [
                    { "user_id": userEmail }
                ]
            };

            // Add interview-specific filter if provided
            if (interviewId) {
                filters.AND.push({
                    "metadata": {
                        "interviewId": interviewId
                    }
                });
            }

            let memories;
            if (query) {
                // Use search for semantic queries
                memories = await this.memory.search(
                    query,
                    {
                        version: "v2",
                        filters: filters,
                        limit: limit
                    }
                );
            } else {
                // Use get_all for retrieving all memories
                memories = await this.memory.get_all({
                    version: "v2",
                    filters: filters,
                    page: 1,
                    page_size: limit
                });
            }

            return memories || [];
        } catch (error) {
            console.error('Error retrieving user memories:', error);
            throw error;
        }
    }

    /**
     * Get interview history for a user
     * @param {string} userEmail - Email of the user
     * @param {boolean} isAdmin - Whether the user is an admin
     * @param {string} specificInterviewId - If provided, only get history for this interview
     */
    async getInterviewHistory(userEmail, isAdmin = false, specificInterviewId = null) {
        if (!this.initialized) await this.initialize();
        
        // Return empty array if Neo4j is not available
        if (!this.neo4jAvailable) {
            console.log('Neo4j not available - interview history not accessible');
            return [];
        }

        try {
            const session = this.neo4jDriver.session();
            let cypher;
            let params = { userEmail };

            if (isAdmin && !specificInterviewId) {
                // Admin gets global history across all interviews
                cypher = `
                    MATCH (u:User {email: $userEmail})-[:PARTICIPATED_IN]->(s:Session)-[:BELONGS_TO]->(i:Interview)
                    WHERE s.isCompleted = true
                    RETURN i.id as interviewId, i.title as interviewTitle, 
                           count(s) as sessionsCount, 
                           max(s.completedAt) as lastCompletedAt
                    ORDER BY lastCompletedAt DESC
                `;
            } else if (specificInterviewId) {
                // Get history for specific interview only
                cypher = `
                    MATCH (u:User {email: $userEmail})-[:PARTICIPATED_IN]->(s:Session)-[:BELONGS_TO]->(i:Interview {id: $interviewId})
                    WHERE s.isCompleted = true
                    RETURN s.id as sessionId, s.completedAt as completedAt, 
                           i.id as interviewId, i.title as interviewTitle
                    ORDER BY completedAt DESC
                `;
                params.interviewId = specificInterviewId;
            } else {
                // Guest user gets history siloed to specific interview
                cypher = `
                    MATCH (u:User {email: $userEmail})-[:PARTICIPATED_IN]->(s:Session)-[:BELONGS_TO]->(i:Interview)
                    WHERE s.isCompleted = true
                    RETURN s.id as sessionId, s.completedAt as completedAt, 
                           i.id as interviewId, i.title as interviewTitle
                    ORDER BY completedAt DESC
                `;
            }

            const result = await session.run(cypher, params);
            await session.close();

            return result.records.map(record => ({
                sessionId: record.get('sessionId'),
                interviewId: record.get('interviewId'),
                interviewTitle: record.get('interviewTitle'),
                completedAt: record.get('completedAt'),
                sessionsCount: record.get('sessionsCount') // Only for admin summary
            }));
        } catch (error) {
            console.error('Error getting interview history:', error);
            return [];
        }
    }

    /**
     * Get contextual memories for generating questions
     * @param {string} userEmail - Email of the user
     * @param {string} interviewId - ID of the current interview
     * @param {string} currentContext - Current conversation context
     * @param {boolean} isAdminTakingInterview - Flag indicating if the user being interviewed is an admin
     */
    async getContextualMemories(userEmail, interviewId, currentContext, isAdminTakingInterview = false) {
        if (!this.initialized) await this.initialize();

        try {
            // Search for relevant memories based on current context
            let searchMetadata = {};
            if (isAdminTakingInterview) {
                // Admin's memory spans all their interactions
                console.log(`[MemoryService] Admin ${userEmail} is taking interview ${interviewId}. Searching their global memories.`);
                // No specific interview_id filter for admin's own memories
            } else {
                // Guest's memory is siloed to the current interview template
                console.log(`[MemoryService] Guest ${userEmail} is taking interview ${interviewId}. Searching memories for this template only.`);
                searchMetadata.interview_id = interviewId;
            }

            // Start both queries in parallel with timeout
            const startTime = Date.now();
            const MEMORY_TIMEOUT = 5000; // 5 second timeout
            
            const memoriesPromise = Promise.race([
                this.memory.search(
                    currentContext,
                    {
                        user_id: userEmail,
                        metadata: Object.keys(searchMetadata).length > 0 ? searchMetadata : undefined, // Pass undefined if metadata is empty
                        limit: 5
                    }
                ),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Memory search timeout after 5s')), MEMORY_TIMEOUT)
                )
            ]).catch(err => {
                console.error(`[MemoryService] Memory search failed:`, err.message);
                return []; // Return empty memories on error
            });

            // Get graph relationships if Neo4j is available
            let graphPromise = null;
            if (this.neo4jAvailable) {
                graphPromise = Promise.race([
                    (async () => {
                        const session = this.neo4jDriver.session();
                        try {
                            const result = await session.run(
                                `MATCH (u:User {email: $email})-[:PARTICIPATED_IN]->(i:Interview {id: $interviewId})
                                 OPTIONAL MATCH (u)-[:COMPLETED]->(s:Session)-[:BELONGS_TO]->(i)
                                 WITH u, i, count(s) as sessionCount
                                 RETURN u, i, sessionCount`,
                                { email: userEmail, interviewId: interviewId }
                            );

                            return result.records[0] ? {
                                user: result.records[0].get('u')?.properties,
                                interview: result.records[0].get('i')?.properties,
                                previousSessions: result.records[0].get('sessionCount')?.toNumber() || 0
                            } : null;
                        } finally {
                            await session.close();
                        }
                    })(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Neo4j query timeout after 3s')), 3000)
                    )
                ]).catch(err => {
                    console.error(`[MemoryService] Neo4j query failed:`, err.message);
                    return null; // Return null on error
                });
            }

            // Wait for both in parallel
            const [memories, graphContext] = await Promise.all([
                memoriesPromise,
                graphPromise || Promise.resolve(null)
            ]);
            
            console.log(`[MemoryService] Memory operations completed in ${Date.now() - startTime}ms`);

            return {
                memories,
                graphContext,
                hasHistory: memories.length > 0 || (graphContext?.previousSessions > 0)
            };

        } catch (error) {
            console.error('Error getting contextual memories:', error);
            throw error;
        }
    }

    /**
     * Update memory after interview completion
     */
    async updateInterviewCompletion(sessionId, reportContent) {
        if (!this.initialized) await this.initialize();
        
        if (!this.neo4jAvailable) {
            console.log('Neo4j not available - skipping interview completion update');
            return;
        }

        const session = this.neo4jDriver.session();
        try {
            await session.run(
                `MATCH (s:Session {id: $sessionId})
                 SET s.completed = true, 
                     s.completedAt = datetime(),
                     s.reportGenerated = true
                 RETURN s`,
                { sessionId }
            );

            console.log(`Updated session ${sessionId} as completed`);
        } catch (error) {
            console.error('Error updating interview completion:', error);
        } finally {
            await session.close();
        }
    }

    /**
     * Clean up resources
     */
    async close() {
        if (this.neo4jDriver) {
            await this.neo4jDriver.close();
        }
        this.initialized = false;
        this.neo4jAvailable = false;
    }
}

// Create singleton instance
const memoryService = new InterviewMemoryService();

module.exports = memoryService; 