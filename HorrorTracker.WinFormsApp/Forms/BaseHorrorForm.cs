namespace HorrorTracker.WinFormsApp.Forms
{
    /// <summary>
    /// Base form for all Horror Tracker forms with common functionality.
    /// </summary>
    public class BaseHorrorForm : Form
    {
        /// <summary>
        /// Sets the cursor to a hand pointer for all buttons on the form.
        /// </summary>
        protected void SetHandCursorForButtons()
        {
            foreach (Control control in this.Controls)
            {
                SetHandCursorRecursive(control);
            }
        }

        /// <summary>
        /// Recursively sets hand cursor for all buttons in a control and its children.
        /// </summary>
        /// <param name="control">The control to process.</param>
        private void SetHandCursorRecursive(Control control)
        {
            if (control is Button)
            {
                control.Cursor = Cursors.Hand;
            }
            
            foreach (Control childControl in control.Controls)
            {
                SetHandCursorRecursive(childControl);
            }
        }
    }
}