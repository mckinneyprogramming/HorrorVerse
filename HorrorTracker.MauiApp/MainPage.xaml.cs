namespace HorrorTracker.MauiApp;

public partial class MainPage : ContentPage
{
	int count = 0;

	public MainPage()
	{
		InitializeComponent();
	}

	private void OnCounterClicked(object? sender, EventArgs e)
	{
		count++;

		if (count == 1)
			CounterBtn.Text = $"Entered {count} time";
		else
			CounterBtn.Text = $"Entered {count} times";

		SemanticScreenReader.Announce(CounterBtn.Text);
	}
}
