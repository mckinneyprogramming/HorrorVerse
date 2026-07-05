using Foundation;
using MauiHostApp = Microsoft.Maui.Hosting.MauiApp;

namespace HorrorTracker.MauiApp;

[Register("AppDelegate")]
public class AppDelegate : MauiUIApplicationDelegate
{
	protected override MauiHostApp CreateMauiApp() => MauiProgram.CreateMauiApp();
}
