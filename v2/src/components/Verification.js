/**
 * Verification Module
 * Validates research results for accuracy
 */
export default class Verification {
    /**
     * @param {Object} tools - Tools component instance
     */
    constructor(tools) {
        this.tools = tools;
    }

    /**
     * Verify a research result
     * @param {Object} company - Company object
     * @param {Object} question - Question object
     * @param {Object} result - Research result to verify
     * @returns {Promise<Object>} Verified result
     */
    async verifyResult(company, question, result) {
        // Skip verification for high confidence results
        if (result.confidence === 'HIGH') {
            return { ...result, verified: true };
        }
        
        // Special verification for owner name question
        if (question.text === "Who is the president or owner of the company?") {
            return await this.verifyOwnerName(company, result);
        }
        
        // Verification for yes/no questions
        if (result.answer === 'YES' || result.answer === 'NO') {
            return await this.verifyYesNo(company, question, result);
        }
        
        // Default: mark as verified without additional checks
        return { ...result, verified: true };
    }

    /**
     * Verify owner name
     * @param {Object} company - Company object
     * @param {Object} result - Research result
     * @returns {Promise<Object>} Verified result
     */
    async verifyOwnerName(company, result) {
        // Skip verification for unknown results
        if (result.answer === 'unknown' || result.answer === 'UNKNOWN' || result.answer === 'NO') {
            return { ...result, verified: true };
        }
        
        try {
            // Create verification query using the name found
            const verificationQuery = `Verify if ${result.answer} is definitely the current owner, CEO, president or founder of ${company.companyName}. Find at least two different sources to confirm this information.`;
            
            // Perform verification search
            const verificationResult = await this.tools.perplexitySearch(verificationQuery);
            
            // Check if verification confirms the name
            const confirmationScore = this.calculateConfirmationScore(
                verificationResult.content, 
                result.answer, 
                company.companyName
            );
            
            let verifiedResult = { ...result };
            
            if (confirmationScore >= 0.7) {
                // High confirmation: upgrade confidence
                verifiedResult.confidence = 'HIGH';
                verifiedResult.verification = {
                    verified: true,
                    score: confirmationScore,
                    source: 'additional search'
                };
            } else if (confirmationScore >= 0.4) {
                // Medium confirmation: keep same confidence
                verifiedResult.verification = {
                    verified: true,
                    score: confirmationScore,
                    source: 'additional search'
                };
            } else {
                // Low confirmation: downgrade to unknown if very low
                if (confirmationScore < 0.2) {
                    verifiedResult.answer = 'unknown';
                    verifiedResult.confidence = 'LOW';
                }
                
                verifiedResult.verification = {
                    verified: false,
                    score: confirmationScore,
                    source: 'additional search'
                };
            }
            
            verifiedResult.verified = true;
            return verifiedResult;
            
        } catch (error) {
            console.error('Verification error:', error);
            // If verification fails, still mark as verified but note the error
            return {
                ...result,
                verified: true,
                verification: {
                    verified: false,
                    error: error.message,
                    source: 'error'
                }
            };
        }
    }

    /**
     * Verify yes/no question
     * @param {Object} company - Company object
     * @param {Object} question - Question object
     * @param {Object} result - Research result
     * @returns {Promise<Object>} Verified result
     */
    async verifyYesNo(company, question, result) {
        try {
            // Only verify low confidence results
            if (result.confidence !== 'LOW') {
                return { ...result, verified: true };
            }
            
            // Create verification query for yes/no question
            const verificationQuery = `Verify: ${question.text} for the company ${company.companyName}. My initial finding was "${result.answer}" but I need to confirm this with additional sources.`;
            
            // Perform verification search
            const verificationResult = await this.tools.perplexitySearch(verificationQuery);
            
            // Check if verification confirms the result
            const textLower = verificationResult.content.toLowerCase();
            const isPositiveVerification = textLower.includes('yes') && 
                                         textLower.includes('confirm') && 
                                         !textLower.includes('not confirmed');
            
            const isNegativeVerification = textLower.includes('no') && 
                                         textLower.includes('confirm') && 
                                         !textLower.includes('not confirmed');
            
            let verifiedResult = { ...result };
            
            if ((result.answer === 'YES' && isPositiveVerification) || 
                (result.answer === 'NO' && isNegativeVerification)) {
                // Verification confirms the result: upgrade confidence
                verifiedResult.confidence = 'MEDIUM';
                verifiedResult.verification = {
                    verified: true,
                    confirmed: true,
                    source: 'additional search'
                };
            } else if ((result.answer === 'YES' && isNegativeVerification) || 
                       (result.answer === 'NO' && isPositiveVerification)) {
                // Verification contradicts the result: flip the answer
                verifiedResult.answer = result.answer === 'YES' ? 'NO' : 'YES';
                verifiedResult.confidence = 'MEDIUM';
                verifiedResult.verification = {
                    verified: true,
                    contradicted: true,
                    source: 'additional search'
                };
            } else {
                // Verification is inconclusive: keep the same confidence
                verifiedResult.verification = {
                    verified: true,
                    inconclusive: true,
                    source: 'additional search'
                };
            }
            
            verifiedResult.verified = true;
            return verifiedResult;
            
        } catch (error) {
            console.error('Verification error:', error);
            // If verification fails, still mark as verified but note the error
            return {
                ...result,
                verified: true,
                verification: {
                    verified: false,
                    error: error.message,
                    source: 'error'
                }
            };
        }
    }

    /**
     * Calculate confirmation score for owner name verification
     * @param {string} text - Verification text
     * @param {string} name - Owner name
     * @param {string} companyName - Company name
     * @returns {number} Confirmation score between 0 and 1
     */
    calculateConfirmationScore(text, name, companyName) {
        const textLower = text.toLowerCase();
        const nameLower = name.toLowerCase();
        const companyNameLower = companyName.toLowerCase();
        
        let score = 0;
        
        // Check for confirmation phrases
        if (textLower.includes('confirmed') || textLower.includes('verified')) {
            score += 0.3;
        }
        
        // Check for title associations
        const titles = ['ceo', 'founder', 'president', 'owner', 'chief executive'];
        for (const title of titles) {
            if (textLower.includes(`${nameLower} is the ${title}`) || 
                textLower.includes(`${nameLower}, the ${title}`)) {
                score += 0.2;
                break;
            }
        }
        
        // Check for multiple sources mentioned
        if (textLower.includes('sources') || 
            textLower.includes('according to multiple') || 
            (textLower.match(/according to/g) || []).length >= 2) {
            score += 0.2;
        }
        
        // Check for company and name proximity
        const nameAndCompany = textLower.includes(nameLower) && 
                              textLower.includes(companyNameLower);
        if (nameAndCompany) {
            score += 0.2;
        }
        
        // Check for contradictions
        if (textLower.includes('not the') || 
            textLower.includes('no longer') || 
            textLower.includes('former') || 
            textLower.includes('incorrect')) {
            score -= 0.4;
        }
        
        // Ensure score is between 0 and 1
        return Math.max(0, Math.min(1, score));
    }
}