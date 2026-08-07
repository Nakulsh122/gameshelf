import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('search');
    
    if (!query) {
        return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    const clientId = process.env.IGDB_CLIENT_ID;
    const clientSecret = process.env.IGDB_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
        return NextResponse.json({ error: 'IGDB credentials are not configured on the server' }, { status: 500 });
    }

    try {
        // Try to get search results from Cache
        if (redis) {
            const cachedIds = await redis.get(`igdb:search:${query.toLowerCase()}`);
            if (cachedIds && Array.isArray(cachedIds)) {
                // Fetch individual games
                const pipeline = redis.pipeline();
                cachedIds.forEach(id => pipeline.get(`igdb:game:${id}`));
                const cachedGames = await pipeline.exec();
                console.log("cachedGames output:", cachedGames);
                
                // If all games were found in cache, return them
                if (cachedGames.every(game => game !== null)) {
                    return NextResponse.json(cachedGames);
                }
            }
        }

        // Get IGDB Access Token
        let accessToken = null;
        if (redis) {
            accessToken = await redis.get('igdb_access_token');
        }

        if (!accessToken) {
            const tokenRes = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`, {
                method: 'POST'
            });
            
            if (!tokenRes.ok) {
                throw new Error('Failed to fetch Twitch OAuth token');
            }
            
            const tokenData = await tokenRes.json();
            accessToken = tokenData.access_token;
            
            if (redis) {
                // Cache token (expires in ~60 days, we'll cache for 50 days to be safe)
                await redis.set('igdb_access_token', accessToken, { ex: 50 * 24 * 60 * 60 });
            }
        }

        // Search IGDB
        // Increase limit to fetch more results since we'll filter out DLCs and bundles in code
        const igdbRes = await fetch('https://api.igdb.com/v4/games', {
            method: 'POST',
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            },
            body: `fields id, name, cover.url, first_release_date, slug, category; where name ~ *"${query}"*; sort rating desc; limit 20;`
        });
        
        if (!igdbRes.ok) {
            throw new Error(`IGDB API error: ${igdbRes.status}`);
        }
        
        const data = await igdbRes.json();

        // Filter for Main Games (0), Remakes (8), and Remasters (9)
        const filteredData = data.filter(game => [0, 8, 9].includes(game.category ?? 0));
        
        // Take the top 5 results after filtering
        const topResults = filteredData.slice(0, 5);

        // Save normalized data to Cache
        if (redis && topResults.length > 0) {
            const pipeline = redis.pipeline();
            const resultIds = [];
            
            topResults.forEach(game => {
                resultIds.push(game.id);
                // Cache individual game for 30 days
                pipeline.set(`igdb:game:${game.id}`, game, { ex: 30 * 24 * 60 * 60 }); 
            });
            
            // Cache search query mapped to IDs for 24 hours
            pipeline.set(`igdb:search:${query.toLowerCase()}`, resultIds, { ex: 24 * 60 * 60 });
            await pipeline.exec();
        }

        return NextResponse.json(topResults);
    } catch (err) {
        console.error('Search error:', err);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}
