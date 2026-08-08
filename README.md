# 🎮 GameShelf

GameShelf is a modern, sleek web application built to help you track, manage, and organize your video game collection. Whether you're managing a growing backlog, tracking what you're currently playing, or keeping a record of completed games, GameShelf provides an intuitive interface to handle it all.

## 🌟 Features

- **Custom Playlists:** Organize your games into default playlists (Playing, Completed, Backlog, Dropped) or create your own custom categories.
- **Authentication:** Secure user authentication and data syncing powered by Supabase.
- **Gamer Profile:** Personalize your profile with an avatar and link your Xbox, PSN, and Steam gamer tags.
- **Errands (Quest Tracking):** Keep track of in-game tasks, side quests, or achievements for specific games directly in the app.
- **Dark Mode Support:** A beautifully designed interface that adapts to your preferred theme.
- **Responsive Design:** Seamlessly works across desktop and mobile devices.

## 🛠️ Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (React)
- **Database & Auth:** [Supabase](https://supabase.com/)
- **Caching/State:** [Upstash Redis](https://upstash.com/)
- **Styling:** Vanilla CSS / Modern UI conventions

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- A Supabase project

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Nakulsh122/gameshelf.git
   cd gameshelf
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env.local` file in the root directory and add your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) with your browser to see the app.

## 📖 How to Use GameShelf (User Guide)

Once the app is running (or you visit the live site), here is how you can get started:

1. **Sign Up / Log In:** 
   - When you first open the app, you will be prompted to create an account or log in using your email. 
   - Your data is securely saved so you can access your GameShelf from any device.

2. **Add Games to Your Library:**
   - Use the search bar at the top to find games you want to track.
   - Click the **"+"** icon next to a game.
   - Choose which playlist to add it to (e.g., *Playing*, *Completed*, *Backlog*, or *Dropped*).

3. **Manage Playlists:**
   - Navigate to the sidebar to view your games grouped by playlist.
   - You can create your own custom playlists (like "Couch Co-op" or "2024 Must Plays") by clicking "New Playlist" in the sidebar.
   - Move games between playlists as your progress changes.

4. **Track Errands & Quests:**
   - Open the **Errands** tab from the sidebar.
   - Select a game you are currently playing.
   - Add specific tasks, side quests, or achievements you want to remember to complete.

5. **Personalize Your Profile:**
   - Click on your avatar in the top right to open your Profile.
   - Update your Gamer Tags (Xbox Live, PSN, Steam) so all your gaming identities are in one place.

## 🚀 Deployment

This project is configured for continuous deployment with Vercel. 
Simply push your changes to the `main` branch, and Vercel will automatically build and deploy the updates.

## 🔮 Future Enhancements (Roadmap)

We are constantly looking to improve GameShelf! Here are some features we plan to add in the future:

- **Third-Party API Integration (IGDB/RAWG):** Automatically fetch official game cover art, descriptions, release dates, and genres when searching for a game.
- **Social & Sharing:** 
  - Ability to make your GameShelf public and share a unique link with friends.
  - Follow other users and see their recent activity.
- **Advanced Stats & Tracking:** 
  - Track hours played for each game.
  - Give games a star rating out of 5 and write personal reviews.
- **Achievements Syncing:** Automatically pull in your actual achievements and trophies from Steam, Xbox, and PlayStation.
- **Sorting & Filtering:** Filter your library by platform, genre, or release year.

## 📝 License

This project is licensed under the MIT License.
