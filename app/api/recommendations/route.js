import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export async function POST(request) {
    let games = [];
    try {
        const body = await request.json();
        games = body.games || [];
    } catch(e) {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!games || games.length === 0) {
        return NextResponse.json({ error: 'games array is required' }, { status: 400 });
    }

    const randomGame = games[Math.floor(Math.random() * games.length)];
    const gameId = randomGame.game_id;
    
    if (!gameId) {
        return NextResponse.json({ error: 'gameId is required' }, { status: 400 });
    }

    const clientId = process.env.IGDB_CLIENT_ID;
    const clientSecret = process.env.IGDB_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
        return NextResponse.json({ error: 'IGDB credentials are not configured on the server' }, { status: 500 });
    }

    try {
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
                await redis.set('igdb_access_token', accessToken, { ex: 50 * 24 * 60 * 60 });
            }
        }

        // Fetch similar_games for the provided game ID
        const similarRes = await fetch('https://api.igdb.com/v4/games', {
            method: 'POST',
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            },
            body: `fields similar_games; where id = ${gameId};`
        });
        
        if (!similarRes.ok) {
            throw new Error(`IGDB API error fetching similar games: ${similarRes.status}`);
        }
        
        const similarData = await similarRes.json();
        
        if (!similarData || similarData.length === 0 || !similarData[0].similar_games || similarData[0].similar_games.length === 0) {
            return NextResponse.json({ error: 'No similar games found' }, { status: 404 });
        }

        const similarGameIds = similarData[0].similar_games;
        // Pick one random similar game ID
        const randomSimilarGameId = similarGameIds[Math.floor(Math.random() * similarGameIds.length)];

        // Now fetch details for this random similar game
        const gameRes = await fetch('https://api.igdb.com/v4/games', {
            method: 'POST',
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            },
            body: `fields id, name, cover.url, first_release_date, slug, category; where id = ${randomSimilarGameId};`
        });

        if (!gameRes.ok) {
            throw new Error(`IGDB API error fetching game details: ${gameRes.status}`);
        }

        const gameData = await gameRes.json();

        if (!gameData || gameData.length === 0) {
             return NextResponse.json({ error: 'Game details not found' }, { status: 404 });
        }

        return NextResponse.json(gameData[0]);
    } catch (err) {
        console.error('Recommendation error:', err);
        return NextResponse.json({ error: 'Failed to fetch recommendation' }, { status: 500 });
    }
}
