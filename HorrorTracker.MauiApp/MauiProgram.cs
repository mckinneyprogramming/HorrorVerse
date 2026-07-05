using Microsoft.Extensions.Logging;
using MauiHostApp = Microsoft.Maui.Hosting.MauiApp;

namespace HorrorTracker.MauiApp;

public static class MauiProgram
{
	public static MauiHostApp CreateMauiApp()
	{
		var builder = MauiHostApp.CreateBuilder();
		builder
			.UseMauiApp<App>()
			.ConfigureFonts(fonts =>
			{
				fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
				fonts.AddFont("OpenSans-Semibold.ttf", "OpenSansSemibold");
			});

#if DEBUG
		builder.Logging.AddDebug();
#endif

		return builder.Build();
	}
}
