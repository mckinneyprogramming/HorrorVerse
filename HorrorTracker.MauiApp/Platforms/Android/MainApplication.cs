using Android.App;
using Android.Runtime;
using MauiHostApp = Microsoft.Maui.Hosting.MauiApp;

namespace HorrorTracker.MauiApp;

[Application]
public class MainApplication : MauiApplication
{
	public MainApplication(IntPtr handle, JniHandleOwnership ownership)
		: base(handle, ownership)
	{
	}

	protected override MauiHostApp CreateMauiApp() => MauiProgram.CreateMauiApp();
}
