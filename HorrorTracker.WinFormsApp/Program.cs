using HorrorTracker.WinFormsApp.Forms;
using HorrorTracker.Utilities.Logging;
using Serilog;
using Serilog.Events;
using System.Configuration;

namespace HorrorTracker.WinFormsApp
{
    /// <summary>
    /// The main entry point for the application.
    /// </summary>
    internal static class Program
    {
        /// <summary>
        /// The main entry point for the application.
        /// </summary>
        [STAThread]
        static void Main()
        {
            // Configure Serilog using shared configurator
            Log.Logger = SerilogConfigurator.ConfigureLogger("horrortracker", LogEventLevel.Debug);

            try
            {
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);

                // Try to get connection string from environment variable first
                string? connectionString = Environment.GetEnvironmentVariable("HorrorVerseDb");
                
                // Fall back to App.config if environment variable not set
                if (string.IsNullOrWhiteSpace(connectionString))
                {
                    Log.Information("Environment variable 'HorrorVerseDb' not found. Checking App.config...");
                    connectionString = ConfigurationManager.ConnectionStrings["HorrorTrackerConnection"]?.ConnectionString;
                }

                if (string.IsNullOrWhiteSpace(connectionString))
                {
                    Log.Error("No connection string found in environment variable or App.config.");
                    MessageBox.Show(
                        "Connection string not found.\n\n" +
                        "Please set the 'HorrorVerseDb' environment variable or configure App.config.",
                        "Configuration Error",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error);
                    return;
                }

                Log.Information($"Using connection string: {MaskPassword(connectionString)}");
                
                var logger = new LoggerService();

                Application.Run(new MainForm(connectionString, logger));
            }
            catch (Exception ex)
            {
                Log.Fatal(ex, "Application start-up failed");
                MessageBox.Show($"Failed to start application: {ex.Message}", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                Log.CloseAndFlush();
            }
        }

        /// <summary>
        /// Masks the password in a connection string for safe logging.
        /// </summary>
        private static string MaskPassword(string connectionString)
        {
            if (string.IsNullOrWhiteSpace(connectionString))
                return connectionString;

            var parts = connectionString.Split(';');
            for (int i = 0; i < parts.Length; i++)
            {
                if (parts[i].Trim().StartsWith("Password=", StringComparison.OrdinalIgnoreCase))
                {
                    parts[i] = "Password=****";
                }
            }
            return string.Join(";", parts);
        }
    }
}