import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import JSZip from 'jszip';
import saveAs from 'file-saver';
import { AppStep, StepStatus, WpConfig, HistoryItem, OutputLanguage } from './types';
import { executeStep1, executeStep2, executeStep3, executeStep4, generateBlogImage, resetSession } from './services/geminiService';
import { getHistory, saveHistoryItem, deleteHistoryItem } from './services/storageService';
import { StepIndicator } from './components/StepIndicator';
import { ResultViewer } from './components/ResultViewer';
import { HistorySidebar } from './components/HistorySidebar';
import { Loader2, Send, Settings, ArrowRight, Check, History, List, X, Languages, Download, Copy, FileText, Package, Code, Sparkles, FileCode, Tag } from 'lucide-react';

const App: React.FC = () => {
  // State
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.INPUT);
  const [status, setStatus] = useState<StepStatus>(StepStatus.IDLE);
  const [bulkInput, setBulkInput] = useState(''); // Textarea input
  const [language, setLanguage] = useState<OutputLanguage>('vi'); // Language selection
  const [categoryInput, setCategoryInput] = useState('Marathon'); // Category input

  const [queue, setQueue] = useState<string[]>([]); // Processing queue
  const [completedCount, setCompletedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [currentKeyword, setCurrentKeyword] = useState(''); // Currently processing keyword
  
  const [statusMessage, setStatusMessage] = useState('');
  
  // Results
  const [ideationResult, setIdeationResult] = useState(''); 
  const [outlineResult, setOutlineResult] = useState(''); 
  const [articleResult, setArticleResult] = useState(''); 

  // History & Logs
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [viewingHistoryItem, setViewingHistoryItem] = useState<HistoryItem | null>(null);

  // Export State
  const [isZipping, setIsZipping] = useState(false);
  const [copyCleanSuccess, setCopyCleanSuccess] = useState(false);

  // Scroll ref
  const bottomRef = useRef<HTMLDivElement>(null);

  // Constants for Style
  const GOLD_GRADIENT = 'linear-gradient(135deg, rgb(255, 215, 0), rgb(255, 165, 0))';

  // Load History on Mount
  useEffect(() => {
    const loadData = async () => {
        const loadedHistory = await getHistory();
        setHistory(loadedHistory);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (status !== StepStatus.IDLE && bottomRef.current) {
      setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [ideationResult, outlineResult, articleResult, status, statusMessage]);

  // --- Bulk Processing Logic ---

  const handleStartBulk = async () => {
    const keywords = bulkInput
      .split('\n')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    if (keywords.length === 0) return;

    setQueue(keywords);
    setTotalCount(keywords.length);
    setCompletedCount(0);
    setStatus(StepStatus.LOADING);
    
    // Start processing the first keyword, capture current language
    processNextKeyword(keywords, language);
  };

  const processNextKeyword = async (remainingQueue: string[], selectedLang: OutputLanguage) => {
    if (remainingQueue.length === 0) {
      setStatus(StepStatus.COMPLETE);
      setStatusMessage("All keywords processed successfully!");
      setCurrentKeyword('');
      return;
    }

    const keyword = remainingQueue[0];
    const nextQueue = remainingQueue.slice(1);
    
    setCurrentKeyword(keyword);
    setQueue(nextQueue);
    setCompletedCount(prev => totalCount - remainingQueue.length);
    
    // Reset UI for new keyword
    setCurrentStep(AppStep.INPUT);
    setIdeationResult('');
    setOutlineResult('');
    setArticleResult('');
    resetSession();

    try {
      const langLabel = selectedLang === 'vi' ? 'VI' : 'EN';

      // --- Step 1 ---
      setStatusMessage(`[${keyword}][${langLabel}] Researching data (Step 1/4)...`);
      await executeStep1(keyword, selectedLang);

      // --- Step 2 ---
      setStatusMessage(`[${keyword}][${langLabel}] Generating Ideation (Step 2/4)...`);
      const ideation = await executeStep2(keyword, selectedLang);
      setIdeationResult(ideation);
      setCurrentStep(AppStep.IDEATION);

      // --- Step 3 ---
      setStatusMessage(`[${keyword}][${langLabel}] Creating Outline (Step 3/4)...`);
      const outline = await executeStep3(selectedLang);
      setOutlineResult(outline);
      setCurrentStep(AppStep.OUTLINE);

      // --- Step 4 ---
      setStatusMessage(`[${keyword}][${langLabel}] Writing Article (Step 4/4)...`);
      const rawArticle = await executeStep4(keyword, selectedLang);
      setArticleResult(rawArticle);
      setCurrentStep(AppStep.WRITING);

      // --- Images ---
      setStatusMessage(`[${keyword}] Generating Images (Vietnamese Context)...`);
      
      // Regex handles both [FEATURED_IMAGE_PROMPT: ...] and [IMAGE_PROMPT: ...]
      const imageRegex = /\[(?:FEATURED_IMAGE_PROMPT|IMAGE_PROMPT|HÌNH ẢNH):\s*(.*?)\]/gi;
      let finalArticle = rawArticle;
      const matches = [...rawArticle.matchAll(imageRegex)];
      
      if (matches.length > 0) {
        let processedCount = 0;
        for (const m of matches) {
            const fullTag = m[0];
            const prompt = m[1];
            const isFeatured = fullTag.includes('FEATURED_IMAGE_PROMPT');
            
            setStatusMessage(`[${keyword}] Image ${processedCount + 1}/${matches.length} ${isFeatured ? '(Thumbnail)' : ''}...`);
            
            const base64Image = await generateBlogImage(prompt);
            
            if (base64Image) {
                // If it's featured, we mark it specifically in Markdown with a special Alt Text
                // so we can identify it during export.
                const markdownImage = isFeatured 
                    ? `\n![FEATURED_IMAGE](${base64Image})\n`
                    : `\n\n![${prompt}](${base64Image})\n`;
                
                finalArticle = finalArticle.replace(fullTag, markdownImage);
            } else {
                finalArticle = finalArticle.replace(fullTag, ``);
            }
            setArticleResult(finalArticle);
            processedCount++;

            // RATE LIMIT PROTECTION: Add 6s delay between image requests
            if (processedCount < matches.length) {
              await new Promise(r => setTimeout(r, 6000));
            }
        }
      }

      // --- Save to History ---
      const newItem: HistoryItem = {
        id: "", // Service will assign unique ID
        keyword: keyword,
        content: finalArticle,
        timestamp: Date.now(),
        language: selectedLang
      };
      
      console.log("Saving article to DB...");
      const updatedHistory = await saveHistoryItem(newItem);
      setHistory(updatedHistory);

      // --- Trigger Next ---
      setCompletedCount(prev => prev + 1);
      
      // Small delay between articles to avoid rate limits abruptly
      setStatusMessage(`[${keyword}] Finished! Starting next in 3s...`);
      await new Promise(r => setTimeout(r, 3000));
      
      processNextKeyword(nextQueue, selectedLang);

    } catch (error) {
      console.error(error);
      const errorItem: HistoryItem = {
        id: "",
        keyword: keyword + " (FAILED)",
        content: `Error processing: ${error}`,
        timestamp: Date.now(),
        language: selectedLang
      };
      const updatedHistory = await saveHistoryItem(errorItem);
      setHistory(updatedHistory);
      
      setStatusMessage(`Error with "${keyword}". Moving to next...`);
      await new Promise(r => setTimeout(r, 2000));
      processNextKeyword(nextQueue, selectedLang);
    }
  };

  // --- REGENERATE IMAGE LOGIC ---
  const handleRegenerateImage = async (oldSrc: string, altText: string) => {
      // Find the current content (either live or viewing history)
      const currentContent = viewingHistoryItem ? viewingHistoryItem.content : articleResult;
      
      // FIX: If it's the FEATURED IMAGE, the altText is just "FEATURED_IMAGE", which creates garbage images.
      // We must use the keyword or title to regenerate a proper thumbnail.
      let promptToUse = altText;
      const targetKeyword = viewingHistoryItem ? viewingHistoryItem.keyword : currentKeyword;

      if (altText === 'FEATURED_IMAGE') {
          promptToUse = `Photography of ${targetKeyword}, cinematic lighting, 8k, realistic, highly detailed, relevant to the topic of ${targetKeyword}.`;
      } else {
          // Add some noise to normal prompts to ensure variation
          promptToUse = `${altText} (Variation ${Math.floor(Math.random() * 100)})`;
      }

      // Generate new image
      const newBase64 = await generateBlogImage(promptToUse);
      
      if (newBase64) {
          // Replace in content string
          const newContent = currentContent.replace(oldSrc, newBase64);
          
          if (viewingHistoryItem) {
              const updatedItem = { ...viewingHistoryItem, content: newContent };
              setViewingHistoryItem(updatedItem);
              const updatedHistory = await saveHistoryItem(updatedItem);
              setHistory(updatedHistory);
          } else {
              setArticleResult(newContent);
              const existingItem = history.find(h => h.keyword === currentKeyword);
              if (existingItem) {
                  const updatedItem = { ...existingItem, content: newContent };
                  const updatedHistory = await saveHistoryItem(updatedItem);
                  setHistory(updatedHistory);
              }
          }
      } else {
          alert("Could not regenerate image. Please try again.");
      }
  };

  // History Handlers
  const handleDeleteHistory = async (id: string) => {
    const updated = await deleteHistoryItem(id);
    setHistory(updated);
    if (viewingHistoryItem?.id === id) setViewingHistoryItem(null);
  };

  const handleSelectHistory = (item: HistoryItem) => {
    setViewingHistoryItem(item);
    setShowHistory(false);
  };

  // --- EXPORT LOGIC ---

  const parseArticleData = (markdownContent: string, keyword: string) => {
    // Extract Meta Data
    const titleMatch = markdownContent.match(/Meta Title:\s*(.*)/);
    const descMatch = markdownContent.match(/Meta Description:\s*(.*)/);
    const slugMatch = markdownContent.match(/Slug:\s*(.*)/);

    const title = titleMatch ? titleMatch[1].trim() : keyword;
    const metaDesc = descMatch ? descMatch[1].trim() : '';
    const slug = slugMatch ? slugMatch[1].trim() : keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    // Clean Content
    const metaBlockRegex = /========== META DATA ==========\n([\s\S]*?)=============================/;
    let cleanBody = markdownContent.replace(metaBlockRegex, "").trim();
    cleanBody = cleanBody
        .replace(/========== NỘI DUNG BÀI VIẾT ==========/, "")
        .replace(/========== KẾT THÚC BÀI VIẾT ==========/, "")
        // Remove Labels specifically
        .replace(/\[INTRO\]/gi, "")
        .replace(/\[BODY\]/gi, "")
        .replace(/\[CONCLUSION\]/gi, "")
        .replace(/\*\*INTRO\*\*/gi, "")
        .replace(/\[(?:FEATURED_IMAGE_PROMPT|IMAGE_PROMPT|HÌNH ẢNH):.*?\]/g, "")
        .trim();
    
    return { title, metaDesc, slug, cleanBody };
  };

  const handleCopyCleanHtml = async () => {
    const rawContent = viewingHistoryItem ? viewingHistoryItem.content : articleResult;
    const keyword = viewingHistoryItem ? viewingHistoryItem.keyword : currentKeyword;
    const { cleanBody } = parseArticleData(rawContent, keyword);
    
    // Convert to HTML first using marked
    let html = await marked.parse(cleanBody);

    // Replace Base64 images with Placeholders using Regex on HTML
    let imgIndex = 1;
    html = html.replace(/<img[^>]*src=["']data:[^"']*["'][^>]*alt=["']([^"']*)["'][^>]*>/gi, (match, alt) => {
         const isFeatured = alt === 'FEATURED_IMAGE';
         const label = isFeatured ? 'FEATURED IMAGE (Thumbnail)' : `IMAGE ${imgIndex}`;
         
         const placeholder = `<div style="background-color: ${isFeatured ? '#fff7ed' : '#f8fafc'}; border: 2px dashed ${isFeatured ? '#f97316' : '#cbd5e1'}; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <p style="font-weight: bold; color: ${isFeatured ? '#c2410c' : '#1e40af'}; margin-bottom: 5px;">[CHÈN ẢNH: ${label}]</p>
            <p style="color: #64748b; font-size: 0.9em; font-style: italic;">Alt Text: ${alt}</p>
         </div>`;
         if (!isFeatured) imgIndex++;
         return placeholder;
    });

    try {
        await navigator.clipboard.writeText(html);
        setCopyCleanSuccess(true);
        setTimeout(() => setCopyCleanSuccess(false), 3000);
    } catch (err) {
        console.error('Failed to copy', err);
        alert('Failed to copy code.');
    }
  };

  // Helper to compress specific Base64 string if it's too large (for existing history items)
  const compressIfNeeded = async (base64Str: string): Promise<string> => {
      if (base64Str.startsWith('data:image/jpeg') && base64Str.length < 500000) return base64Str;
      return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const MAX_WIDTH = 1024;
            if (width > MAX_WIDTH) {
                height = Math.round((height * MAX_WIDTH) / width);
                width = MAX_WIDTH;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            } else {
                resolve(base64Str);
            }
        };
        img.onerror = () => resolve(base64Str);
      });
  };

  // Fix: Implemented handleDownloadPackage to solve missing name error
  const handleDownloadPackage = async () => {
    setIsZipping(true);
    try {
      const rawContent = viewingHistoryItem ? viewingHistoryItem.content : articleResult;
      const keyword = viewingHistoryItem ? viewingHistoryItem.keyword : currentKeyword;
      const { slug, cleanBody } = parseArticleData(rawContent, keyword);

      const zip = new JSZip();
      const imgFolder = zip.folder("images");

      const imageRegex = /!\[(.*?)\]\((data:image\/.*?;base64,.*?)\)/g;
      const matches = [...cleanBody.matchAll(imageRegex)];
      let processedContent = cleanBody;

      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const fullTag = match[0];
        const altText = match[1];
        const base64Data = match[2];

        let ext = 'jpg';
        if (base64Data.includes('image/png')) ext = 'png';
        if (base64Data.includes('image/webp')) ext = 'webp';

        const filename = `image-${i + 1}.${ext}`;
        const base64Content = base64Data.split(',')[1];

        imgFolder?.file(filename, base64Content, { base64: true });
        
        // Update markdown to point to local images
        processedContent = processedContent.split(fullTag).join(`![${altText}](images/${filename})`);
      }

      zip.file(`${slug}.md`, processedContent);

      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `${slug}-package.zip`);
    } catch (e) {
      console.error("Failed to zip", e);
      alert("Failed to download package.");
    } finally {
      setIsZipping(false);
    }
  };

  const handleDownloadWxrXml = async () => {
    setIsZipping(true);
    try {
        const rawContent = viewingHistoryItem ? viewingHistoryItem.content : articleResult;
        const keyword = viewingHistoryItem ? viewingHistoryItem.keyword : currentKeyword;
        const { title, metaDesc, slug, cleanBody } = parseArticleData(rawContent, keyword);
        const safeCategory = categoryInput.trim() || 'General';
        
        // --- 1. PREPARE DATA ---
        const postId = Math.floor(Math.random() * 100000) + 1000;
        const postDate = new Date().toISOString().replace('T', ' ').split('.')[0];
        
        const imageRegex = /!\[(.*?)\]\((data:image\/.*?;base64,.*?)\)/g;
        const matches = [...cleanBody.matchAll(imageRegex)];

        // We will store attachments to append to XML later
        let attachmentItemsXml = '';
        let featuredImageId = '';
        
        // --- 2. PROCESS IMAGES FOR XML ---
        let optimizedBody = cleanBody;

        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            const fullTag = match[0];
            const altText = match[1];
            const base64 = match[2];
            
            const compressedBase64 = await compressIfNeeded(base64);
            const attachmentId = postId + i + 1; 
            
            // Check if this is the FEATURED IMAGE based on specific Alt tag
            const isFeatured = altText === 'FEATURED_IMAGE';
            
            if (isFeatured) {
                featuredImageId = attachmentId.toString();
                // REMOVE Featured Image from the body content (standard WP practice)
                optimizedBody = optimizedBody.split(fullTag).join('');
            } else {
                // Normal Image -> Convert to HTML Figure
                const htmlFigure = `
<!-- wp:image {"id":${attachmentId}} -->
<figure class="wp-block-image"><img src="${compressedBase64}" alt="${altText}" class="wp-image-${attachmentId}"/><figcaption>${altText}</figcaption></figure>
<!-- /wp:image -->`;
                optimizedBody = optimizedBody.split(fullTag).join(htmlFigure);
            }

            // Create Attachment Item XML (Common for both types)
            attachmentItemsXml += `
    <item>
		<title><![CDATA[${altText}]]></title>
		<link></link>
		<pubDate>${new Date().toUTCString()}</pubDate>
		<dc:creator><![CDATA[admin]]></dc:creator>
		<guid isPermaLink="false"></guid>
		<description></description>
		<content:encoded><![CDATA[${compressedBase64}]]></content:encoded>
		<excerpt:encoded><![CDATA[${altText}]]></excerpt:encoded>
		<wp:post_id>${attachmentId}</wp:post_id>
		<wp:post_date>${postDate}</wp:post_date>
		<wp:comment_status>open</wp:comment_status>
		<wp:ping_status>open</wp:ping_status>
		<wp:post_name><![CDATA[image-${attachmentId}]]></wp:post_name>
		<wp:status>inherit</wp:status>
		<wp:post_parent>${postId}</wp:post_parent>
		<wp:menu_order>0</wp:menu_order>
		<wp:post_type>attachment</wp:post_type>
		<wp:post_password></wp:post_password>
		<wp:is_sticky>0</wp:is_sticky>
		<wp:attachment_url><![CDATA[image-${attachmentId}.jpg]]></wp:attachment_url>
		<wp:postmeta>
			<wp:meta_key>_wp_attached_file</wp:meta_key>
			<wp:meta_value><![CDATA[${new Date().getFullYear()}/${new Date().getMonth()+1}/image-${attachmentId}.jpg]]></wp:meta_value>
		</wp:postmeta>
        <wp:postmeta>
            <wp:meta_key>_wp_attachment_image_alt</wp:meta_key>
            <wp:meta_value><![CDATA[${altText}]]></wp:meta_value>
        </wp:postmeta>
	</item>`;
        }

        const htmlContent = await marked.parse(optimizedBody);

        const xmlContent = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0"
	xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
	xmlns:content="http://purl.org/rss/1.0/modules/content/"
	xmlns:wfw="http://wellformedweb.org/CommentAPI/"
	xmlns:dc="http://purl.org/dc/elements/1.1/"
	xmlns:wp="http://wordpress.org/export/1.2/"
>
<channel>
	<title>BestMarathon Export</title>
	<pubDate>${new Date().toUTCString()}</pubDate>
	<language>vi</language>
	<wp:wxr_version>1.2</wp:wxr_version>
	<item>
		<title><![CDATA[${title}]]></title>
		<link></link>
		<pubDate>${new Date().toUTCString()}</pubDate>
		<dc:creator><![CDATA[admin]]></dc:creator>
		<guid isPermaLink="false"></guid>
		<description></description>
		<content:encoded><![CDATA[${htmlContent}]]></content:encoded>
		<excerpt:encoded><![CDATA[]]></excerpt:encoded>
		<wp:post_id>${postId}</wp:post_id>
		<wp:post_date>${postDate}</wp:post_date>
		<wp:comment_status>open</wp:comment_status>
		<wp:ping_status>open</wp:ping_status>
		<wp:post_name><![CDATA[${slug}]]></wp:post_name>
		<wp:status>draft</wp:status>
		<wp:post_parent>0</wp:post_parent>
		<wp:menu_order>0</wp:menu_order>
		<wp:post_type>post</wp:post_type>
		<wp:post_password></wp:post_password>
		<wp:is_sticky>0</wp:is_sticky>
        <category domain="category" nicename="${safeCategory.toLowerCase().replace(/\s+/g, '-')}"><![CDATA[${safeCategory}]]></category>
        ${featuredImageId ? `
        <wp:postmeta>
            <wp:meta_key>_thumbnail_id</wp:meta_key>
            <wp:meta_value><![CDATA[${featuredImageId}]]></wp:meta_value>
        </wp:postmeta>` : ''}
        <!-- SEO METADATA -->
        <wp:postmeta>
            <wp:meta_key>_yoast_wpseo_title</wp:meta_key>
            <wp:meta_value><![CDATA[${title}]]></wp:meta_value>
        </wp:postmeta>
        <wp:postmeta>
            <wp:meta_key>_yoast_wpseo_metadesc</wp:meta_key>
            <wp:meta_value><![CDATA[${metaDesc}]]></wp:meta_value>
        </wp:postmeta>
        <wp:postmeta>
            <wp:meta_key>rank_math_title</wp:meta_key>
            <wp:meta_value><![CDATA[${title}]]></wp:meta_value>
        </wp:postmeta>
        <wp:postmeta>
            <wp:meta_key>rank_math_description</wp:meta_key>
            <wp:meta_value><![CDATA[${metaDesc}]]></wp:meta_value>
        </wp:postmeta>
	</item>
    ${attachmentItemsXml}
</channel>
</rss>`;

        const blob = new Blob([xmlContent], { type: "text/xml;charset=utf-8" });
        saveAs(blob, `${slug || 'article'}.xml`);

    } catch (e) {
        console.error("XML Export Error", e);
        alert("Failed to create XML file");
    } finally {
        setIsZipping(false);
    }
  };

  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center p-8 text-slate-500 animate-pulse bg-white rounded-xl border border-blue-100 shadow-sm mb-8">
      <Loader2 className="w-10 h-10 animate-spin mb-4 text-orange-500" />
      <p className="text-lg font-medium text-slate-800">{statusMessage}</p>
      <div className="w-full max-w-md bg-slate-100 rounded-full h-2.5 mt-4 overflow-hidden">
        <div 
          className="h-2.5 rounded-full transition-all duration-500" 
          style={{ 
            width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`,
            background: GOLD_GRADIENT 
          }}
        ></div>
      </div>
      <p className="text-xs mt-2 text-slate-500">Processed {completedCount} of {totalCount} keywords</p>
    </div>
  );
  
  // New "Manual Export" Component
  const ExportActions = () => (
      <div className="flex flex-col space-y-3 items-end">
         
         <div className="text-sm text-slate-500 mb-2 font-medium">Export Options:</div>

         <div className="flex flex-wrap gap-3 justify-end">
             {/* Option 3: XML Import (NEW) */}
             <button 
                onClick={handleDownloadWxrXml}
                disabled={isZipping}
                className="flex items-center space-x-2 bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 px-4 py-3 rounded-lg font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50"
                title="Download .xml file to import directly into WordPress (Tools > Import)"
             >
                {isZipping ? <Loader2 size={20} className="animate-spin"/> : <FileCode size={20} />}
                <span>WP Import (.xml)</span>
             </button>

             {/* Option 2: Full Package */}
             <button 
                onClick={handleDownloadPackage}
                disabled={isZipping}
                className="flex items-center space-x-2 text-white px-5 py-3 rounded-lg font-bold shadow-md transition-all active:scale-95 disabled:opacity-70 disabled:grayscale"
                style={{ background: GOLD_GRADIENT }}
                title="Download ZIP with separate named images (image-1.png, etc)"
             >
                {isZipping ? <Loader2 size={20} className="animate-spin" /> : <Package size={20} />}
                <span>Download All (.zip)</span>
             </button>
             
             {/* Option 1: Clean HTML */}
             <button 
                onClick={handleCopyCleanHtml}
                className="flex items-center space-x-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-4 py-3 rounded-lg font-bold shadow-sm transition-all active:scale-95"
                title="Copy HTML code without huge base64 strings."
             >
                {copyCleanSuccess ? <Check size={20} className="text-green-600"/> : <Code size={20} />}
             </button>
         </div>
         
         {copyCleanSuccess && (
             <div className="text-green-600 text-sm font-semibold animate-in fade-in slide-in-from-top-1">
                 Copied Clean HTML!
             </div>
         )}
         
         <div className="text-xs text-slate-500 bg-white p-3 rounded-lg border border-slate-200 shadow-sm max-w-sm text-right">
             <p className="mb-1 text-orange-600 font-semibold">🔥 Recommended: Use "WP Import (.xml)"</p>
             <p>Go to <b>Tools {'>'} Import {'>'} WordPress</b> to upload this file. Title, Slug, & SEO Meta will be set automatically.</p>
         </div>
      </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative">
      
      <HistorySidebar 
        isOpen={showHistory} 
        onClose={() => setShowHistory(false)} 
        history={history}
        onSelect={handleSelectHistory}
        onDelete={handleDeleteHistory}
      />

      {viewingHistoryItem && (
        <div className="fixed inset-0 z-50 bg-slate-100 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 py-8">
             <div className="flex items-center justify-between mb-6">
                <button 
                  onClick={() => setViewingHistoryItem(null)}
                  className="flex items-center text-slate-600 hover:text-orange-600 font-bold bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200"
                >
                  <ArrowRight className="rotate-180 mr-2" /> Back to Generator
                </button>
                <div className="flex flex-col items-end">
                   <div className="flex items-center space-x-2 mb-2">
                      <span className="text-xs font-bold text-slate-400 uppercase">{viewingHistoryItem.language || 'vi'}</span>
                      <span className="text-sm text-slate-500">Saved on {new Date(viewingHistoryItem.timestamp).toLocaleDateString()}</span>
                   </div>
                   <ExportActions />
                </div>
             </div>
             <ResultViewer 
               title={`[LOG] ${viewingHistoryItem.keyword}`} 
               content={viewingHistoryItem.content} 
               isCollapsible={false}
               onRegenerateImage={handleRegenerateImage}
             />
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm/50 backdrop-blur-md bg-white/90">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-lg"
              style={{ background: GOLD_GRADIENT }}
            >
              <Sparkles size={20} />
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight hidden md:block">BestMarathon Wizard</h1>
          </div>
          
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setShowHistory(true)}
              className="flex items-center px-4 py-2 text-slate-600 hover:bg-orange-50 hover:text-orange-700 rounded-full transition-all border border-transparent hover:border-orange-100 font-medium text-sm group"
            >
              <History size={18} className="mr-2 group-hover:text-orange-500" />
              <span>History ({history.length})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={`flex-1 max-w-5xl mx-auto w-full px-4 pb-20 pt-6 transition-opacity ${viewingHistoryItem ? 'opacity-0 pointer-events-none fixed' : 'opacity-100'}`}>
        
        {status !== StepStatus.IDLE && status !== StepStatus.COMPLETE && (
           <StepIndicator currentStep={currentStep} />
        )}

        <div className="space-y-8 mt-6">
          
          {status === StepStatus.IDLE && (
            <section className="animate-in fade-in zoom-in duration-300">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden relative">
                {/* Decorative Top Bar */}
                <div className="h-1.5 w-full" style={{ background: GOLD_GRADIENT }}></div>
                
                <div className="p-8 md:p-10">
                  <div className="flex items-center justify-between mb-8">
                     <div className="flex items-center">
                       <div 
                          className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl mr-5 shadow-inner"
                          style={{ background: 'rgba(255, 165, 0, 0.1)', color: 'rgb(255, 140, 0)' }}
                        >
                          1
                       </div>
                       <div>
                          <h2 className="text-2xl font-bold text-slate-800">Keyword Input</h2>
                          <p className="text-slate-500 text-sm mt-1">Enter topics to generate SEO optimized content.</p>
                       </div>
                     </div>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="relative group">
                       <textarea
                         value={bulkInput}
                         onChange={(e) => setBulkInput(e.target.value)}
                         placeholder="e.g.&#10;Kỷ lục marathon thế giới&#10;Lịch tập chạy 21km&#10;Dinh dưỡng cho runner..."
                         className="w-full h-48 text-lg border border-slate-200 rounded-xl p-5 focus:ring-4 focus:ring-orange-100 focus:border-orange-400 outline-none transition-all shadow-sm font-mono text-slate-700 leading-relaxed resize-none bg-slate-50 group-hover:bg-white"
                       />
                       <div className="absolute top-4 right-4 pointer-events-none text-slate-300">
                          <List size={20} />
                       </div>
                    </div>
                    
                    <div className="flex flex-col md:flex-row items-stretch gap-4 pt-2">
                       {/* CATEGORY INPUT */}
                       <div className="w-full md:w-1/4">
                         <div className="relative h-full">
                           <input
                             type="text"
                             value={categoryInput}
                             onChange={(e) => setCategoryInput(e.target.value)}
                             placeholder="Category (e.g. Marathon)"
                             className="w-full h-full bg-white border border-slate-200 text-slate-700 py-3.5 px-5 pl-10 rounded-xl leading-tight focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400 shadow-sm font-medium hover:border-orange-300 transition-colors"
                           />
                           <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-3 text-slate-400">
                             <Tag size={18} />
                           </div>
                         </div>
                      </div>

                      <div className="w-full md:w-1/4">
                         <div className="relative h-full">
                           <select
                             value={language}
                             onChange={(e) => setLanguage(e.target.value as OutputLanguage)}
                             className="w-full h-full appearance-none bg-white border border-slate-200 text-slate-700 py-3.5 px-5 pr-10 rounded-xl leading-tight focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400 shadow-sm font-medium cursor-pointer hover:border-orange-300 transition-colors"
                           >
                             <option value="vi">🇻🇳 Tiếng Việt</option>
                             <option value="en">🇬🇧 English</option>
                           </select>
                           <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                             <Languages size={18} />
                           </div>
                         </div>
                      </div>

                      <button
                        onClick={handleStartBulk}
                        disabled={!bulkInput.trim()}
                        className="flex-1 w-full flex items-center justify-center px-8 py-4 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:hover:scale-100 transition-all uppercase tracking-wide"
                        style={{ 
                          background: GOLD_GRADIENT,
                          textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                        }}
                      >
                        <Send className="mr-3" size={22} />
                        Start Automation
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
          
          {status === StepStatus.LOADING && renderLoading()}

          {status === StepStatus.COMPLETE && (
            <div className="bg-white border border-green-100 shadow-lg rounded-xl p-10 text-center animate-in zoom-in duration-300 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-green-500"></div>
               <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                 <Check size={40} />
               </div>
               <h2 className="text-3xl font-bold text-slate-800 mb-3">All Tasks Completed!</h2>
               <p className="text-slate-500 mb-8 max-w-md mx-auto">Processed {totalCount} keywords successfully. All articles have been saved to the history log.</p>
               <div className="flex justify-center space-x-4">
                  <button 
                    onClick={() => setShowHistory(true)}
                    className="bg-white border-2 border-slate-100 text-slate-600 hover:border-orange-200 hover:text-orange-600 px-8 py-3 rounded-xl font-bold transition-all"
                  >
                    View History
                  </button>
                  <button 
                    onClick={() => {
                       setStatus(StepStatus.IDLE);
                       setBulkInput('');
                       setIdeationResult('');
                       setOutlineResult('');
                       setArticleResult('');
                       setCompletedCount(0);
                       setTotalCount(0);
                    }} 
                    className="text-white px-8 py-3 rounded-xl font-bold transition-all shadow-md hover:shadow-lg"
                    style={{ background: GOLD_GRADIENT }}
                  >
                    Start New Batch
                  </button>
               </div>
            </div>
          )}

          {(status === StepStatus.LOADING || status === StepStatus.COMPLETE) && (
            <>
              {ideationResult && (
                <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <ResultViewer 
                      title={`Step 2: Ideation (${currentKeyword})`} 
                      content={ideationResult} 
                      isCollapsible={true}
                      defaultOpen={false}
                    />
                </section>
              )}

              {outlineResult && (
                <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                    <ResultViewer 
                      title={`Step 3: Outline (${currentKeyword})`} 
                      content={outlineResult} 
                      isCollapsible={true}
                      defaultOpen={false}
                    />
                </section>
              )}

              {articleResult && (
                <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200 space-y-6">
                    <ResultViewer 
                      title={`Step 4: Writing (${currentKeyword})`} 
                      content={articleResult} 
                      isCollapsible={true}
                      defaultOpen={true}
                      onRegenerateImage={handleRegenerateImage}
                    />

                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex items-center justify-between">
                       <div className="flex items-center space-x-3 text-slate-600">
                          <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
                             <Settings size={24} />
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">Ready to Publish</p>
                            <p className="text-sm text-slate-500">Export your content below.</p>
                          </div>
                       </div>
                       <ExportActions />
                    </div>
                </section>
              )}
            </>
          )}

          <div ref={bottomRef} />

        </div>
      </main>
    </div>
  );
};

export default App;