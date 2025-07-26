"""
Trending content discovery API endpoints.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timedelta
import random

router = APIRouter()

# Mock trending content data - in production this would come from various APIs
MOCK_TRENDING_DATA = [
    {
        "id": "trending-1",
        "title": "Revolutionary AI Model Achieves Human-Level Performance",
        "description": "New breakthrough in artificial intelligence shows unprecedented capabilities in reasoning and problem-solving tasks across multiple domains.",
        "url": "https://example.com/ai-breakthrough",
        "platform": "news",
        "category": "technology",
        "trending_score": 95,
        "view_count": 1250000,
        "engagement_count": 45000,
        "created_at": (datetime.now() - timedelta(hours=2)).isoformat(),
        "thumbnail": "https://via.placeholder.com/400x300/3b82f6/ffffff?text=AI+Breakthrough",
        "author": {
            "name": "TechNews Daily",
            "verified": True
        },
        "metrics": {
            "likes": 12500,
            "shares": 3400,
            "comments": 890
        },
        "tags": ["AI", "Machine Learning", "Technology", "Innovation"]
    },
    {
        "id": "trending-2",
        "title": "How to Build Scalable React Applications in 2024",
        "description": "Complete guide to modern React development patterns, performance optimization, and best practices for enterprise applications.",
        "url": "https://youtube.com/watch?v=example",
        "platform": "youtube",
        "category": "education",
        "trending_score": 87,
        "view_count": 890000,
        "engagement_count": 23000,
        "created_at": (datetime.now() - timedelta(hours=5)).isoformat(),
        "thumbnail": "https://via.placeholder.com/400x300/ef4444/ffffff?text=React+2024",
        "author": {
            "name": "CodeMaster Pro",
            "verified": True
        },
        "metrics": {
            "likes": 18900,
            "comments": 1200
        },
        "tags": ["React", "JavaScript", "Frontend", "Tutorial", "Web Development"]
    },
    {
        "id": "trending-3",
        "title": "Scientists Discover New Method for Clean Energy Production",
        "description": "Breakthrough research shows 300% more efficient solar panel technology using quantum dot arrays and novel materials.",
        "url": "https://science-journal.com/clean-energy",
        "platform": "news",
        "category": "science",
        "trending_score": 92,
        "view_count": 567000,
        "engagement_count": 15600,
        "created_at": (datetime.now() - timedelta(hours=8)).isoformat(),
        "author": {
            "name": "Nature Science",
            "verified": True
        },
        "metrics": {
            "likes": 8900,
            "shares": 2100,
            "comments": 445
        },
        "tags": ["Science", "Energy", "Solar", "Research", "Environment"]
    },
    {
        "id": "trending-4",
        "title": "Open Source Vector Database Reaches 50k GitHub Stars",
        "description": "Community-driven vector database project gains massive adoption for AI and ML applications with lightning-fast performance.",
        "url": "https://github.com/example/vectordb",
        "platform": "github",
        "category": "technology",
        "trending_score": 83,
        "view_count": 156000,
        "engagement_count": 5200,
        "created_at": (datetime.now() - timedelta(hours=16)).isoformat(),
        "author": {
            "name": "VectorDB Team",
            "verified": False
        },
        "metrics": {
            "upvotes": 4800,
            "comments": 890
        },
        "tags": ["Open Source", "Database", "AI", "GitHub", "Vector Search"]
    },
    {
        "id": "trending-5",
        "title": "Viral TikTok Dance Takes Over Social Media",
        "description": "New dance trend spreads across platforms with millions of recreations and celebrity endorsements.",
        "url": "https://tiktok.com/@user/video",
        "platform": "twitter",
        "category": "entertainment",
        "trending_score": 76,
        "view_count": 2340000,
        "engagement_count": 89000,
        "created_at": (datetime.now() - timedelta(hours=24)).isoformat(),
        "thumbnail": "https://via.placeholder.com/400x300/8b5cf6/ffffff?text=Viral+Dance",
        "author": {
            "name": "DanceVibes",
            "verified": True
        },
        "metrics": {
            "likes": 67000,
            "shares": 15000,
            "comments": 7000
        },
        "tags": ["Dance", "Viral", "Social Media", "Entertainment", "Trends"]
    },
    {
        "id": "trending-6",
        "title": "Cryptocurrency Market Shows Strong Recovery",
        "description": "Major cryptocurrencies surge as institutional adoption increases and regulatory clarity improves globally.",
        "url": "https://crypto-news.com/market-recovery",
        "platform": "news",
        "category": "business",
        "trending_score": 81,
        "view_count": 445000,
        "engagement_count": 12300,
        "created_at": (datetime.now() - timedelta(hours=12)).isoformat(),
        "author": {
            "name": "CryptoDaily",
            "verified": True
        },
        "metrics": {
            "likes": 7800,
            "shares": 2900,
            "comments": 1600
        },
        "tags": ["Cryptocurrency", "Bitcoin", "Finance", "Investment", "Market"]
    }
]

@router.get("/", summary="Get trending content")
async def get_trending_content(
    category: Optional[str] = Query(None, description="Filter by category"),
    platform: Optional[str] = Query(None, description="Filter by platform"),
    time_range: str = Query("24h", description="Time range (1h, 24h, 7d, 30d)"),
    search: Optional[str] = Query(None, description="Search in title, description, or tags"),
    limit: int = Query(50, ge=1, le=100, description="Number of results to return")
):
    """
    Get trending content across platforms with filtering and search capabilities.
    
    Returns curated trending content from various platforms including:
    - YouTube videos
    - News articles  
    - GitHub repositories
    - Social media posts
    - Reddit discussions
    """
    try:
        # Filter data based on parameters
        filtered_data = MOCK_TRENDING_DATA.copy()
        
        # Filter by category
        if category and category != "all":
            filtered_data = [item for item in filtered_data if item["category"] == category]
        
        # Filter by platform  
        if platform and platform != "all":
            filtered_data = [item for item in filtered_data if item["platform"] == platform]
        
        # Filter by search term
        if search:
            search_lower = search.lower()
            filtered_data = [
                item for item in filtered_data 
                if (search_lower in item["title"].lower() or 
                    search_lower in item["description"].lower() or
                    any(search_lower in tag.lower() for tag in item["tags"]))
            ]
        
        # Filter by time range (mock implementation - in production would filter by actual dates)
        time_multiplier = {
            "1h": 1.0,
            "24h": 0.8, 
            "7d": 0.6,
            "30d": 0.4
        }.get(time_range, 0.8)
        
        for item in filtered_data:
            # Adjust trending score based on time range
            item["trending_score"] = int(item["trending_score"] * time_multiplier)
        
        # Sort by trending score
        filtered_data.sort(key=lambda x: x["trending_score"], reverse=True)
        
        # Apply limit
        filtered_data = filtered_data[:limit]
        
        return {
            "success": True,
            "count": len(filtered_data),
            "filters": {
                "category": category,
                "platform": platform,
                "time_range": time_range,
                "search": search
            },
            "content": filtered_data
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get trending content: {str(e)}")

@router.get("/categories", summary="Get available categories")
async def get_categories():
    """
    Get list of available content categories.
    """
    categories = [
        {"id": "all", "name": "All Categories", "icon": "🌐"},
        {"id": "technology", "name": "Technology", "icon": "💻"},
        {"id": "science", "name": "Science", "icon": "🔬"},
        {"id": "business", "name": "Business", "icon": "💼"},
        {"id": "entertainment", "name": "Entertainment", "icon": "🎬"},
        {"id": "sports", "name": "Sports", "icon": "⚽"},
        {"id": "politics", "name": "Politics", "icon": "🏛️"},
        {"id": "health", "name": "Health", "icon": "🏥"},
        {"id": "education", "name": "Education", "icon": "📚"}
    ]
    
    return {
        "success": True,
        "categories": categories
    }

@router.get("/platforms", summary="Get available platforms")
async def get_platforms():
    """
    Get list of supported platforms.
    """
    platforms = [
        {"id": "all", "name": "All Platforms", "icon": "🌍"},
        {"id": "youtube", "name": "YouTube", "icon": "📺"},
        {"id": "twitter", "name": "Twitter/X", "icon": "🐦"},
        {"id": "reddit", "name": "Reddit", "icon": "📱"},
        {"id": "news", "name": "News", "icon": "📰"},
        {"id": "github", "name": "GitHub", "icon": "⚡"}
    ]
    
    return {
        "success": True,
        "platforms": platforms
    }

@router.get("/stats", summary="Get trending statistics")
async def get_trending_stats():
    """
    Get statistics about trending content.
    """
    try:
        total_content = len(MOCK_TRENDING_DATA)
        
        # Count by platform
        platform_counts = {}
        category_counts = {}
        
        for item in MOCK_TRENDING_DATA:
            platform = item["platform"]
            category = item["category"]
            
            platform_counts[platform] = platform_counts.get(platform, 0) + 1
            category_counts[category] = category_counts.get(category, 0) + 1
        
        # Calculate average scores
        avg_trending_score = sum(item["trending_score"] for item in MOCK_TRENDING_DATA) / total_content
        avg_engagement = sum(item["engagement_count"] for item in MOCK_TRENDING_DATA if item.get("engagement_count")) / total_content
        
        return {
            "success": True,
            "stats": {
                "total_content": total_content,
                "average_trending_score": round(avg_trending_score, 1),
                "average_engagement": round(avg_engagement),
                "platform_distribution": platform_counts,
                "category_distribution": category_counts,
                "last_updated": datetime.now().isoformat()
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get trending stats: {str(e)}")

@router.get("/item/{content_id}", summary="Get specific trending item")
async def get_trending_item(content_id: str):
    """
    Get detailed information for a specific trending content item.
    """
    try:
        item = next((item for item in MOCK_TRENDING_DATA if item["id"] == content_id), None)
        
        if not item:
            raise HTTPException(status_code=404, detail="Trending content not found")
        
        return {
            "success": True,
            "content": item
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get trending item: {str(e)}")