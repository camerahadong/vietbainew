import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { OutputLanguage } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// We keep a reference to the chat session to maintain context across steps
let chatSession: Chat | null = null;

export const resetSession = () => {
  chatSession = null;
};

export const initializeSession = (language: OutputLanguage = 'vi') => {
  const brandName = language === 'vi' ? "Vietnam's Best Marathon" : "World Best Marathon";
  const systemContext = language === 'vi' 
    ? `Bạn là đại diện của ${brandName} - Chuyên trang về chạy bộ uy tín nhất. Nhiệm vụ của bạn là thực hiện các bước nghiên cứu và viết bài chuyên sâu.`
    : `You are the representative of ${brandName} - The most prestigious running website. Your task is to execute research and writing steps according to detailed requests.`;

  chatSession = ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      systemInstruction: systemContext,
      tools: [{ googleSearch: {} }]
    }
  });
};

const appendSources = (text: string, response: GenerateContentResponse) => {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (!chunks || chunks.length === 0) return text;
  
  let sourcesMd = "\n\n### Nguồn tham khảo (Sources)\n";
  chunks.forEach((chunk: any) => {
    if (chunk.web) {
      sourcesMd += `- [${chunk.web.title || 'Source'}](${chunk.web.uri})\n`;
    }
  });
  return text + sourcesMd;
};

// --- CONSTANTS FOR PERSONA ---
const WEBSITE_URL = "https://bestmarathon.vn";

export const executeStep1 = async (keyword: string, language: OutputLanguage): Promise<string> => {
  if (!chatSession) initializeSession(language);

  // STEP 1: DATA INGESTION
  const promptVi = `STEP 1:

Read detailed data in Vietnamese. I will ask you to use this content in the next or future requests. Call this data is 'DS1'.

{{
Tìm kiếm và tổng hợp thông tin chi tiết về chủ đề: "${keyword}".
Bao gồm: đặc điểm chính, thông số kỹ thuật (nếu có), lợi ích, đối tượng khách hàng, các số liệu mới nhất 2024-2025 và các thông tin liên quan khác. Nguồn thông tin càng chi tiết, bài viết càng chất lượng.
}}`;

  const promptEn = `STEP 1:

Read detailed data in English. I will ask you to use this content in the next or future requests. Call this data is 'DS1'.

{{
Search and summarize detailed information about the topic: "${keyword}".
Include: key features, specifications (if any), benefits, target audience, latest 2024-2025 data, and other relevant info.
}}`;

  const prompt = language === 'vi' ? promptVi : promptEn;

  try {
    const response: GenerateContentResponse = await chatSession!.sendMessage({ message: prompt });
    const text = response.text || "Data DS1 processed.";
    return appendSources(text, response);
  } catch (error) {
    console.error("Step 1 Error:", error);
    throw error;
  }
};

export const executeStep2 = async (keyword: string, language: OutputLanguage): Promise<string> => {
  if (!chatSession) initializeSession(language);

  // STEP 2: IDEATION & ANALYSIS
  const promptVi = `STEP 2:

Ideation: [ ${keyword} ]. 

**A. KEYWORD ANALYSIS:**
- List 5-7 semantic keywords (từ khóa ngữ nghĩa liên quan trực tiếp)
- List 5-7 LSI keywords (từ khóa liên quan ngữ cảnh)
- List 5-7 long-tail keyword variations

**B. ENTITY MAPPING:**
- List 5-7 primary entities (thực thể chính, sắp xếp theo mức độ quan trọng)
- List 5-7 related entities (thực thể liên quan)
- List 3-5 contextual entities (thực thể bổ sung ngữ cảnh)

**C. SEARCH INTENT ANALYSIS:**
- List 4-6 search intents (sắp xếp từ quan trọng nhất đến ít quan trọng nhất)
- Với mỗi intent, xác định: [Informational / Commercial / Transactional / Navigational]

**D. PEOPLE ALSO ASK:**
- List 5-7 câu hỏi mà người dùng thường tìm kiếm liên quan đến keyword chính

**E. KNOWLEDGE GRAPH SIGNALS:**
- List 20 EAV (Entity - Attribute - Value)
- List 20 ERE (Entity - Relation - Entity)
- List 20 Semantic Triple (Subject - Predicate - Object)

Temporarily call the above data 'DDD1'. I will ask you to use it in the next or future prompt.

**Conditions:** No descriptions. No repeats. All items must be unique and relevant. Writing in Vietnamese.`;

  // English version mirrors the structure but outputs English
  const promptEn = `STEP 2:

Ideation: [ ${keyword} ]. 

**A. KEYWORD ANALYSIS:**
- List 5-7 semantic keywords
- List 5-7 LSI keywords
- List 5-7 long-tail keyword variations

**B. ENTITY MAPPING:**
- List 5-7 primary entities (prioritized)
- List 5-7 related entities
- List 3-5 contextual entities

**C. SEARCH INTENT ANALYSIS:**
- List 4-6 search intents (prioritized)
- Identify: [Informational / Commercial / Transactional / Navigational]

**D. PEOPLE ALSO ASK:**
- List 5-7 common user questions

**E. KNOWLEDGE GRAPH SIGNALS:**
- List 20 EAV (Entity - Attribute - Value)
- List 20 ERE (Entity - Relation - Entity)
- List 20 Semantic Triple (Subject - Predicate - Object)

Temporarily call the above data 'DDD1'.
**Conditions:** No descriptions. No repeats. All items must be unique and relevant. Writing in English.`;

  const prompt = language === 'vi' ? promptVi : promptEn;

  try {
    const response: GenerateContentResponse = await chatSession!.sendMessage({ message: prompt });
    const text = response.text || "";
    return appendSources(text, response);
  } catch (error) {
    console.error("Step 2 Error:", error);
    throw error;
  }
};

export const executeStep3 = async (language: OutputLanguage): Promise<string> => {
  if (!chatSession) throw new Error("Session not initialized");

  // STEP 3: OUTLINE
  const promptVi = `STEP 3:

As an SEO expert specializing in content strategy, create a detailed content outline based on DDD1.

**OUTLINE REQUIREMENTS:**

1. **Structure Logic:**
   - H2 đầu tiên phải đáp ứng Search Intent quan trọng nhất của DDD1
   - Các H2 tiếp theo sắp xếp theo thứ tự Search Intent từ quan trọng đến ít quan trọng
   - Đảm bảo flow logic từ trên xuống dưới
   - Tạo H3 chỉ khi thực sự cần thiết

2. **Content Coverage:**
   - Outline phải cover đúng topic của primary keyword
   - Tích hợp Close Entities, Salient Entities, Semantic keywords từ DDD1
   - Đảm bảo Content Gap coverage

3. **E-E-A-T Markers (Lưu ý cho AI writer sau này):**
   - [DATA] - vị trí cần số liệu, facts cụ thể
   - [EXPERT] - vị trí cần insight chuyên môn
   - [EXAMPLE] - vị trí cần ví dụ thực tế

4. **Visual Strategy (QUAN TRỌNG):**
   - **MỖI thẻ H2 (Main Heading) PHẢI CÓ 1 vị trí chèn ảnh.**
   - Đánh dấu bằng marker: [IMAGE_PROMPT]

5. **Placement Markers:**
   - [CTA] - vị trí đặt call-to-action
   - [INTERNAL-LINK] - vị trí phù hợp để internal link

6. **Word Count Estimate:**
   - Ghi estimated word count cho mỗi H2

**RESTRICTIONS:**
- Không dùng thuật ngữ SEO chuyên môn trong heading
- Heading phải tự nhiên, dễ đọc
- Không dùng clickbait

Let's temporarily call the detailed outline above "OL1". I will ask you to use it in the next or future prompt. Writing in Vietnamese.`;

  const promptEn = `STEP 3:

As an SEO expert specializing in content strategy, create a detailed content outline based on DDD1.

**OUTLINE REQUIREMENTS:**

1. **Structure Logic:**
   - First H2 must answer the most critical Search Intent.
   - Subsequent H2s sorted by priority.
   - Logical flow.

2. **Content Coverage:**
   - Cover primary keyword topic.
   - Integrate Entities & Semantic keywords.

3. **E-E-A-T Markers (Instructions for future writer):**
   - [DATA] - specific stats/facts
   - [EXPERT] - expert insights
   - [EXAMPLE] - real examples

4. **Visual Strategy (IMPORTANT):**
   - **EVERY H2 (Main Heading) MUST HAVE an image placeholder.**
   - Use marker: [IMAGE_PROMPT]

5. **Placement Markers:**
   - [CTA]
   - [INTERNAL-LINK]

6. **Word Count Estimate:**
   - Estimate words for each H2.

**RESTRICTIONS:**
- No SEO jargon in headings.
- Headings must be natural.

Call this "OL1". Writing in English.`;

  const prompt = language === 'vi' ? promptVi : promptEn;

  try {
    const response: GenerateContentResponse = await chatSession!.sendMessage({ message: prompt });
    const text = response.text || "";
    return appendSources(text, response);
  } catch (error) {
    console.error("Step 3 Error:", error);
    throw error;
  }
};

export const executeStep4 = async (keyword: string, language: OutputLanguage): Promise<string> => {
  if (!chatSession) throw new Error("Session not initialized");

  const brandName = language === 'vi' ? "Vietnam's Best Marathon" : "World Best Marathon";
  const industry = language === 'vi' ? "Chạy bộ, Marathon, Dinh dưỡng thể thao" : "Running, Marathon, Sports Nutrition";
  const audience = language === 'vi' ? "Runner Việt Nam (từ beginner đến elite)" : "Runners (beginner to elite)";

  // Note: We escape backticks for the example output block in the string
  const promptVi = `STEP 4:

**WRITER CONTEXT:**
- Brand/Author: ${brandName} (Sử dụng tên thương hiệu "Chúng tôi" hoặc "${brandName}", KHÔNG dùng tên cá nhân)
- Website: ${brandName}
- Website URL: ${WEBSITE_URL}
- Industry/Niche: ${industry}
- Target Audience: ${audience}

**CONTENT MISSION:**
Tạo nội dung chất lượng cao, cung cấp thông tin hữu ích và chính xác cho độc giả.

---

### OUTPUT FORMAT (Tuân thủ chính xác):
\`\`\`
========== META DATA ==========
Meta Title: [55-65 ký tự, primary keyword ở đầu hoặc gần đầu]
Meta Description: [145-155 ký tự, chứa primary keyword + value proposition]
Slug: [url-friendly-format]
=============================

========== NỘI DUNG BÀI VIẾT ==========

[FEATURED_IMAGE_PROMPT: Mô tả cực kỳ chi tiết cho Ảnh Đại Diện (Thumbnail). BẮT BUỘC phải chứa hình ảnh liên quan trực tiếp đến từ khóa "${keyword}". Ví dụ nếu là dinh dưỡng phải có đồ ăn, nếu là giày phải có giày. Ảnh phải ấn tượng, 4K, phong cách nhiếp ảnh thể thao chuyên nghiệp.]

[Viết ngay đoạn Intro hấp dẫn khoảng 80-120 từ, chứa từ khóa chính. TUYỆT ĐỐI KHÔNG dùng các tiêu đề như "Intro", "Giới thiệu", "Phần mở đầu". Hãy bắt đầu viết nội dung ngay lập tức.]

---

## [H2-1 từ OL1]
[Nội dung chi tiết, sâu sắc, 250-400 từ]

[IMAGE_PROMPT: Mô tả hình ảnh minh họa cho H2 này. Ảnh cần sáng tạo, nghệ thuật.]

### [H3 nếu có]
[150-250 từ]

---

## [H2-2 từ OL1]
[Nội dung chi tiết... ]

[IMAGE_PROMPT: Mô tả chi tiết hình ảnh...]

---

## [H2-3 từ OL1]
[Nội dung chi tiết... ]

[IMAGE_PROMPT: Mô tả chi tiết hình ảnh...]

---

## [Tiếp tục cho TẤT CẢ các H2 còn lại trong OL1 - Mỗi H2 phải có 1 ảnh]

---

## Kết Luận
- Độ dài: 60-100 từ
- Tóm tắt giá trị chính
- CTA: khuyến khích comment, chia sẻ
- Mention website với link: [${brandName}](${WEBSITE_URL})

========== KẾT THÚC BÀI VIẾT ==========
\`\`\`

---

### WRITING RULES (Bắt buộc tuân thủ):

**1. XỬ LÝ MARKER (CỰC KỲ QUAN TRỌNG):**
- Trong Outline (OL1) có các thẻ như \`[DATA]\`, \`[EXPERT]\`, \`[EXAMPLE]\`.
- Nhiệm vụ của bạn là **THAY THẾ** các thẻ này bằng nội dung thực tế.
- **TUYỆT ĐỐI KHÔNG** in lại các từ khóa trong ngoặc vuông (Ví dụ: KHÔNG ĐƯỢC VIẾT "Theo [EXPERT] thì...").
- Nếu gặp \`[DATA]\` -> Hãy đưa ra số liệu cụ thể từ DS1.
- Nếu gặp \`[EXPERT]\` -> Hãy viết lời khuyên chuyên gia từ ${brandName}.

**2. HÌNH ẢNH:**
- **BẮT BUỘC:** 
  - Đầu bài viết phải có \`[FEATURED_IMAGE_PROMPT: ...]\` (Ảnh đại diện).
  - Sau mỗi phần H2, phải có dòng \`[IMAGE_PROMPT: ...]\` (Ảnh minh họa).
- Hãy mô tả ảnh một cách tự nhiên. **Quan trọng:** Ảnh đại diện phải thể hiện rõ chủ đề "${keyword}".

**3. Tone & Voice:**
- Dùng ngôi "Chúng tôi" (${brandName}) hoặc "Bạn" (người đọc).
- Giọng văn: Thể thao, năng động, chuyên nghiệp.

**4. Formatting:**
- **Bold** các từ khóa quan trọng.
- Sử dụng Markdown Table cho các dữ liệu so sánh/lịch tập.
- KHÔNG dùng câu quá dài (>40 từ).
- **KHÔNG sử dụng các nhãn như [INTRO], [BODY], [CONCLUSION]. Hãy viết thẳng vào nội dung mạch lạc.**

Writing in Vietnamese.`;

  const promptEn = `STEP 4:

**WRITER CONTEXT:**
- Brand/Author: ${brandName} (Use "We" or "${brandName}", DO NOT use personal names)
- Website: ${brandName}
- Website URL: ${WEBSITE_URL}
- Industry/Niche: ${industry}
- Target Audience: ${audience}

**CONTENT MISSION:**
Create high-quality content, providing useful and accurate info.

---

### OUTPUT FORMAT:
\`\`\`
========== META DATA ==========
Meta Title: [55-65 chars]
Meta Description: [145-155 chars]
Slug: [url-friendly-format]
=============================

========== ARTICLE CONTENT ==========

[FEATURED_IMAGE_PROMPT: Detailed prompt for the Main Featured Image (Thumbnail). MUST specifically visualize the keyword "${keyword}". Must be impressive, professional sports photography style, 4K.]

[Start writing the introduction immediately (80-120 words). DO NOT use labels like "Intro" or "Introduction". Just start the content.]

---

## [H2-1 from OL1]
[Detailed content, 250-400 words]

[IMAGE_PROMPT: Detailed creative description for an image.]

### [H3 if needed]
[150-250 words]

---

## [H2-2 from OL1]
[Detailed content...]

[IMAGE_PROMPT: Detailed description...]

---

## [H2-3 from OL1]
[Detailed content...]

[IMAGE_PROMPT: Detailed description...]

---

## [Continue for ALL remaining H2s - Every H2 MUST have an image]

---

## Conclusion
- Summary
- CTA
- Mention website: [${brandName}](${WEBSITE_URL})

========== END OF ARTICLE ==========
\`\`\`

---

### WRITING RULES:

**1. MARKER HANDLING (CRITICAL):**
- The Outline (OL1) contains markers like \`[DATA]\`, \`[EXPERT]\`, \`[EXAMPLE]\`.
- You MUST **REPLACE** these markers with actual content.
- **DO NOT** output the bracketed tags in the final text.
- If you see \`[DATA]\` -> Write specific stats from DS1.
- If you see \`[EXPERT]\` -> Write expert advice from ${brandName}.

**2. IMAGES:**
- **MANDATORY:** 
  - First line of content must be \`[FEATURED_IMAGE_PROMPT: ...]\`.
  - After every H2 section, include \`[IMAGE_PROMPT: ...]\`.
- Describe images naturally. **Important:** The Featured Image must clearly depict "${keyword}".

**3. Tone & Voice:**
- Use "We" (${brandName}) and "You".
- Professional, energetic.

**4. Formatting:**
- **Bold** key terms.
- Use Markdown Tables for data.
- No sentences >40 words.
- **DO NOT use labels like [INTRO], [BODY], [CONCLUSION]. Write the content directly.**

Writing in English.`;

  const prompt = language === 'vi' ? promptVi : promptEn;

  try {
    const response: GenerateContentResponse = await chatSession!.sendMessage({ message: prompt });
    const text = response.text || "";
    return appendSources(text, response);
  } catch (error) {
    console.error("Step 4 Error:", error);
    throw error;
  }
};

/**
 * Compresses and Resizes an image Base64 string.
 * - Max Width: 1024px
 * - Format: JPEG
 * - Quality: 0.6
 */
const compressBase64 = async (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Resize logic: Max width 1024px
            const MAX_WIDTH = 1024;
            if (width > MAX_WIDTH) {
                height = Math.round((height * MAX_WIDTH) / width);
                width = MAX_WIDTH;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // White background for transparent PNGs converted to JPEG
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                
                // Compress to JPEG at 60% quality (Approx 200-300KB)
                const compressed = canvas.toDataURL('image/jpeg', 0.6);
                resolve(compressed);
            } else {
                resolve(base64Str); // Fallback if context fails
            }
        };
        img.onerror = () => resolve(base64Str); // Fallback on error
    });
};

export const generateBlogImage = async (prompt: string): Promise<string | null> => {
    const maxRetries = 5; // Increased from 3
    let attempt = 0;

    // Retry loop for rate limits (429)
    while (attempt < maxRetries) {
        try {
            // Removed negative prompts and "No text" restrictions to allow better creativity
            const enhancedContext = "bối cảnh Việt Nam, người Việt Nam, phong cách chân thực, ảnh chụp chất lượng cao, 4k. (Vietnamese context, realistic style, high quality photography, cinematic lighting).";
            
            const finalPrompt = `Generate a realistic image based on this description: "${prompt}". ${enhancedContext}`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [{ text: finalPrompt }] },
                config: {
                    imageConfig: {
                        aspectRatio: "16:9",
                    }
                }
            });
            
            for (const part of response.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) {
                    const rawBase64 = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    // COMPRESS IMAGE BEFORE RETURNING
                    return await compressBase64(rawBase64);
                }
            }
            return null; // Empty response (no image data)
            
        } catch (error: any) {
            // Handle Rate Limit (429) specifically
            const isRateLimit = error.status === 429 || error.code === 429 || (error.message && (error.message.includes('429') || error.message.includes('quota')));
            
            if (isRateLimit) {
                attempt++;
                if (attempt < maxRetries) {
                    // Exponential backoff: 5s, 10s, 20s, 40s
                    const waitTime = 5000 * Math.pow(2, attempt - 1); 
                    console.warn(`Image Quota Exceeded (429). Retrying in ${waitTime/1000}s... (Attempt ${attempt}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue; // Retry
                } else {
                    console.error("Image generation failed: Max retries exceeded for quota.");
                    return null;
                }
            } else {
                // Other errors (400, 500) - log and fail gracefully so app doesn't crash
                console.error("Image generation error:", error);
                return null;
            }
        }
    }
    return null;
}