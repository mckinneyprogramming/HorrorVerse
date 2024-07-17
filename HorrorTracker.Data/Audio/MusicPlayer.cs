using NAudio.Wave;

namespace HorrorTracker.Data.Audio
{
    /// <summary>
    /// The <see cref="MusicPlayer"/> class.
    /// </summary>
    public class MusicPlayer
    {
        /// <summary>
        /// The folder containing the songs.
        /// </summary>
        private readonly string themeSongsFolder = Path.GetFullPath(@"C:\Users\mckin\Documents\Visual Studio 2022\Projects\HorrorTracker\HorrorTracker.Data\Audio\Songs\");

        /// <summary>
        /// The Random object.
        /// </summary>
        private readonly Random random;

        /// <summary>
        /// Queue of songs.
        /// </summary>
        private readonly Queue<string> songQueue;

        /// <summary>
        /// The lock object.
        /// </summary>
        private readonly object lockObject = new();

        /// <summary>
        /// Initializes a new instance of the <see cref="MusicPlayer"/> class.
        /// </summary>
        public MusicPlayer()
        {
            random = new Random();
            songQueue = new Queue<string>();
        }
        
        /// <summary>
        /// Loads and shuffles the songs.
        /// </summary>
        public void LoadAndShuffleSongs()
        {
            var themeSongs = Directory.GetFiles(themeSongsFolder, "*.mp3").ToList();
            Shuffle(themeSongs);
            foreach (var song in themeSongs)
            {
                songQueue.Enqueue(song);
            }
        }

        /// <summary>
        /// Plays the songs in the queue.
        /// </summary>
        public void StartPlaying()
        {
            Task.Run(() => PlaySongsInQueue());
        }

        /// <summary>
        /// Shuffles the songs in the folder.
        /// </summary>
        /// <param name="list">List of songs.</param>
        private void Shuffle(List<string> list)
        {
            var n = list.Count;
            while (n > 1)
            {
                n--;
                var k = random.Next(n + 1);
                var value = list[k];
                list[k] = list[n];
                list[n] = value;
            }
        }

        /// <summary>
        /// Plays the songs in the queue.
        /// </summary>
        private void PlaySongsInQueue()
        {
            while (songQueue.Count > 0)
            {
                string songPath;
                lock (lockObject)
                {
                    songPath = songQueue.Dequeue();
                }

                PlaySong(songPath);
            }
        }

        /// <summary>
        /// Plays the individual song.
        /// </summary>
        /// <param name="filePath">The file path to the song.</param>
        private static void PlaySong(string filePath)
        {
            using var audioFile = new AudioFileReader(filePath);
            using var outputDevice = new WaveOutEvent();
            outputDevice.Init(audioFile);
            outputDevice.Play();

            while (outputDevice.PlaybackState == PlaybackState.Playing)
            {
                Thread.Sleep(1000);
            }
        }
    }
}