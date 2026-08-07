require('dotenv').config({ path: '.env.local' });

async function testIGDB() {
    const clientId = process.env.IGDB_CLIENT_ID;
    const clientSecret = process.env.IGDB_CLIENT_SECRET;
    
    console.log("Client ID:", clientId);
    console.log("Client Secret:", clientSecret);
    
    try {
        const query = "f1";
        const tokenRes = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`, {
            method: 'POST'
        });
        
        const tokenData = await tokenRes.json();
        console.log("Token Response:", tokenData);
        
        if (!tokenRes.ok) {
            console.log("Failed to get token!");
            return;
        }
        
        const accessToken = tokenData.access_token;
        console.log("Got access token");
        
        const igdbRes = await fetch('https://api.igdb.com/v4/games', {
            method: 'POST',
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            },
            body: `fields id, name, cover.url, first_release_date, slug, category; where name ~ *"f1"*; sort rating desc; limit 20;`
        });
        
        const data = await igdbRes.json();
        console.log("IGDB Response Status:", igdbRes.status);
        console.log("IGDB Response Data:", data);
        
    } catch (err) {
        console.error("Test Error:", err);
    }
}

testIGDB();
