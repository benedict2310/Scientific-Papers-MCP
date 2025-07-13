# SciHarvester MCP Server: LLM Usage Guide

*A comprehensive guide for LLMs to effectively use the SciHarvester scientific literature access system*

---

## 🎯 Quick Start Workflow

### 1. Explore Available Research Areas
```
list_categories(source="arxiv")          # Computer science, physics, math
list_categories(source="openalex")       # All research concepts  
list_categories(source="pmc")            # Biomedical categories
```

### 2. Find Recent Research
```
fetch_latest(source="arxiv", category="cs.AI", count=10)
fetch_latest(source="pmc", category="medicine", count=5)
```

### 3. Find Influential Papers
```
fetch_top_cited(concept="machine learning", since="2023-01-01", count=15)
fetch_top_cited(concept="cancer immunotherapy", since="2022-01-01", count=20)
```

### 4. Get Full Paper Content
```
fetch_content(source="arxiv", paper_id="2401.12345")
fetch_content(source="pmc", paper_id="PMC1234567")
```

---

## 📊 Data Source Comparison & Selection Guide

| Source | Best For | Speed | Content Quality | Full Text |
|--------|----------|-------|-----------------|-----------|
| **arXiv** | CS, Physics, Math preprints | ⚡⚡⚡ | High | ✅ Usually |
| **OpenAlex** | Cross-disciplinary research | ⚡⚡⚡ | Very High | ❌ Abstracts only |
| **PMC** | Biomedical research | ⚡ | Excellent | ✅ Yes |
| **Europe PMC** | Life sciences (EU focus) | ⚡ | Excellent | ✅ Yes |
| **bioRxiv** | Biology/medicine preprints | ⚡⚡ | High | 🔶 Variable |
| **CORE** | Multidisciplinary repository | ⚡⚡ | Good | 🔶 Variable |

### When to Use Which Source:

**🚀 For Speed & Volume:**
- Use `arxiv` or `openalex` for large-scale literature surveys
- Great for getting overviews of research trends

**🔬 For Biomedical Research:**
- Use `pmc` or `europepmc` for high-quality biomedical content
- These provide full-text access to peer-reviewed papers

**📈 For Latest Developments:**
- Use `biorxiv` for cutting-edge biology/medicine preprints
- Use `arxiv` for latest CS/physics/math research

**🌍 For Comprehensive Coverage:**
- Use `openalex` for cross-disciplinary concept analysis
- Use `core` for diverse academic repository content

---

## 🎨 Effective Research Patterns

### Pattern 1: Literature Survey
```bash
# 1. Explore the field
list_categories(source="openalex")

# 2. Find influential foundation papers  
fetch_top_cited(concept="quantum computing", since="2020-01-01", count=25)

# 3. Get recent developments
fetch_latest(source="arxiv", category="quant-ph", count=15)

# 4. Deep dive into key papers
fetch_content(source="arxiv", paper_id="[from step 3 results]")
```

### Pattern 2: Biomedical Research Investigation
```bash
# 1. Check available biomedical categories
list_categories(source="pmc")

# 2. Find recent clinical research
fetch_latest(source="pmc", category="medicine", count=10)

# 3. Look for breakthrough papers
fetch_top_cited(concept="immunotherapy", since="2023-01-01", count=20)

# 4. Get full clinical trial details
fetch_content(source="pmc", paper_id="[PMC ID from results]")
```

### Pattern 3: Emerging Technology Analysis
```bash
# 1. Explore AI/ML concepts
list_categories(source="openalex")

# 2. Find hot recent papers
fetch_latest(source="arxiv", category="cs.LG", count=20)

# 3. Compare with established work
fetch_top_cited(concept="large language models", since="2022-01-01", count=30)

# 4. Analyze specific breakthroughs
fetch_content(source="arxiv", paper_id="[top cited paper ID]")
```

### Pattern 4: Cross-Disciplinary Research
```bash
# 1. Start broad with OpenAlex
fetch_top_cited(concept="artificial intelligence", since="2023-01-01", count=15)

# 2. Narrow to specific applications
fetch_latest(source="pmc", category="bioinformatics", count=10)

# 3. Check preprint activity
fetch_latest(source="biorxiv", category="bioinformatics", count=8)

# 4. Deep dive into intersection papers
fetch_content(source="pmc", paper_id="[relevant ID]")
```

---

## ⚡ Performance Optimization Tips

### Count Strategy
- **Start Small:** Begin with count=5-10 for exploration
- **Scale Up:** Increase to 20-50 for comprehensive surveys
- **Large Analysis:** Use 50-200 only when necessary

### Source Selection for Speed
```bash
# Fast for large queries
fetch_latest(source="arxiv", category="cs.AI", count=50)      # ⚡⚡⚡
fetch_top_cited(concept="machine learning", since="2023-01-01", count=50)  # ⚡⚡⚡

# Slower but higher quality content  
fetch_latest(source="pmc", category="medicine", count=10)     # ⚡ (but worth it)
fetch_content(source="pmc", paper_id="PMC123456")           # ⚡ (comprehensive)
```

### Rate Limiting Awareness
- The server automatically handles rate limiting
- If you hit limits, the system will inform you and suggest retry timing
- Space out large requests when possible

---

## 🔍 Advanced Search Strategies

### Concept Selection for fetch_top_cited
```bash
# Broad concepts (more papers)
fetch_top_cited(concept="artificial intelligence", since="2022-01-01", count=50)

# Specific concepts (focused results)  
fetch_top_cited(concept="transformer neural networks", since="2023-01-01", count=20)

# Interdisciplinary concepts
fetch_top_cited(concept="computational biology", since="2022-01-01", count=30)

# Emerging fields
fetch_top_cited(concept="quantum machine learning", since="2021-01-01", count=15)
```

### Category Selection Best Practices
```bash
# arXiv: Use official category codes
fetch_latest(source="arxiv", category="cs.AI", count=10)        # AI
fetch_latest(source="arxiv", category="physics.quan-ph", count=10)  # Quantum Physics

# PMC: Use descriptive names
fetch_latest(source="pmc", category="neuroscience", count=10)
fetch_latest(source="pmc", category="oncology", count=10)

# OpenAlex: Use natural language or concept IDs
fetch_top_cited(concept="deep learning", since="2023-01-01", count=20)
fetch_top_cited(concept="C41008148", since="2023-01-01", count=20)  # Specific concept ID
```

### Date Range Strategy
```bash
# Hot current topics (last 6 months)
fetch_top_cited(concept="large language models", since="2024-07-01", count=15)

# Established research (2-3 years)
fetch_top_cited(concept="crispr", since="2022-01-01", count=25)

# Historical breakthroughs (longer timeframe)
fetch_top_cited(concept="quantum computing", since="2020-01-01", count=40)
```

---

## 🚨 Common Pitfalls & Solutions

### ❌ Don't Do This
```bash
# Too large initial count
fetch_latest(source="pmc", category="medicine", count=200)  # Will be slow!

# Wrong ID format  
fetch_content(source="pmc", paper_id="2401.12345")  # arXiv ID with PMC source!

# Skipping category exploration
fetch_latest(source="arxiv", category="AI", count=10)  # Wrong category format!
```

### ✅ Do This Instead
```bash
# Start small and scale up
fetch_latest(source="pmc", category="medicine", count=10)   # Good start
# Then increase if needed: count=25, count=50

# Use correct ID with matching source
fetch_content(source="arxiv", paper_id="2401.12345")       # Correct match
fetch_content(source="pmc", paper_id="PMC1234567")         # Correct match

# Always check categories first
list_categories(source="arxiv")                            # See available options
fetch_latest(source="arxiv", category="cs.AI", count=10)   # Use correct format
```

### Error Recovery
- If you get an error about categories, call `list_categories` first
- If rate limited, wait and try with smaller count
- If no results, try broader categories or longer date ranges
- If ID not found, double-check the source-ID pairing

---

## 📋 Real-World Example Workflows

### Workflow 1: "What's new in AI safety research?"
```bash
# Step 1: Explore AI safety concepts
list_categories(source="openalex")  # Look for safety-related concepts

# Step 2: Find recent influential work
fetch_top_cited(concept="AI safety", since="2023-01-01", count=20)

# Step 3: Get latest preprints  
fetch_latest(source="arxiv", category="cs.AI", count=15)

# Step 4: Analyze key papers
fetch_content(source="arxiv", paper_id="[relevant AI safety paper ID]")
```

### Workflow 2: "Cancer immunotherapy breakthroughs"
```bash
# Step 1: Check biomedical categories
list_categories(source="pmc")

# Step 2: Find breakthrough papers
fetch_top_cited(concept="cancer immunotherapy", since="2022-01-01", count=25)

# Step 3: Get recent clinical trials
fetch_latest(source="pmc", category="oncology", count=15)

# Step 4: Full analysis of promising treatments
fetch_content(source="pmc", paper_id="[clinical trial PMC ID]")
```

### Workflow 3: "Quantum computing progress tracking"
```bash
# Step 1: Get foundational highly-cited papers
fetch_top_cited(concept="quantum computing", since="2021-01-01", count=30)

# Step 2: Latest theoretical advances
fetch_latest(source="arxiv", category="quant-ph", count=20)

# Step 3: Cross-disciplinary applications  
fetch_top_cited(concept="quantum machine learning", since="2022-01-01", count=15)

# Step 4: Deep dive into breakthrough algorithms
fetch_content(source="arxiv", paper_id="[quantum algorithm paper ID]")
```

---

## 🎓 Best Practices Summary

### 1. **Always Start with Exploration**
- Use `list_categories` to understand available options
- Don't assume category names - check what's actually available

### 2. **Progressive Scaling**  
- Start with small counts (5-10) to test and understand results
- Scale up gradually based on what you find
- Monitor performance and adjust accordingly

### 3. **Source Selection Strategy**
- Choose sources based on your research needs (speed vs. content quality)
- Use multiple sources for comprehensive coverage
- Match paper IDs with correct sources in `fetch_content`

### 4. **Intelligent Date Ranges**
- Recent dates (6-12 months) for hot topics and current trends
- Medium ranges (2-3 years) for established research areas  
- Longer ranges (5+ years) for comprehensive historical analysis

### 5. **Workflow Integration**
- Combine `fetch_top_cited` (influential work) with `fetch_latest` (current work)
- Use `fetch_content` strategically on the most relevant papers
- Build comprehensive literature understanding through multiple queries

### 6. **Error Handling**
- Always check error messages for specific guidance
- Retry with adjusted parameters when rate limited
- Verify ID formats match the expected source patterns

---

## 🔬 Advanced Research Scenarios

### Meta-Analysis Preparation
```bash
# 1. Comprehensive concept coverage
fetch_top_cited(concept="deep learning", since="2020-01-01", count=100)

# 2. Recent developments
fetch_latest(source="arxiv", category="cs.LG", count=50)

# 3. Cross-reference with different sources
fetch_latest(source="core", category="computer science", count=30)

# 4. Get full text for systematic review
# Use fetch_content on selected papers from above results
```

### Technology Transfer Research  
```bash
# 1. Academic foundations
fetch_top_cited(concept="neural networks", since="2019-01-01", count=40)

# 2. Applied research
fetch_latest(source="arxiv", category="cs.AI", count=25)

# 3. Clinical applications
fetch_latest(source="pmc", category="bioinformatics", count=20)

# 4. Industry preprints
fetch_latest(source="biorxiv", category="bioinformatics", count=15)
```

### Trend Analysis
```bash
# 1. Historical baseline
fetch_top_cited(concept="machine learning", since="2018-01-01", count=50)

# 2. Current state
fetch_top_cited(concept="machine learning", since="2023-01-01", count=30)

# 3. Emerging directions
fetch_latest(source="arxiv", category="cs.LG", count=40)

# 4. Compare evolution through specific papers
# Use fetch_content to analyze how approaches have evolved
```

---

*This guide provides comprehensive strategies for LLMs to effectively leverage the SciHarvester MCP server for scientific literature research. The key is starting with exploration, scaling progressively, and combining different tools for comprehensive research workflows.*