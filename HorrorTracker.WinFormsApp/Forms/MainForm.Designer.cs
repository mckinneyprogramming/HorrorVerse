namespace HorrorTracker.WinFormsApp.Forms
{
    partial class MainForm
    {
        /// <summary>
        /// Required designer variable.
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        /// Clean up any resources being used.
        /// </summary>
        /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        /// <summary>
        /// Required method for Designer support - do not modify
        /// the contents of this method with the code editor.
        /// </summary>
        private void InitializeComponent()
        {
            this.titleLabel = new System.Windows.Forms.Label();
            this.descriptionLabel = new System.Windows.Forms.Label();
            this.statsPanel = new System.Windows.Forms.Panel();
            this.lblWatched = new System.Windows.Forms.Label();
            this.lblWatchedTitle = new System.Windows.Forms.Label();
            this.lblTimeLeft = new System.Windows.Forms.Label();
            this.lblTimeLeftTitle = new System.Windows.Forms.Label();
            this.lblTotalTime = new System.Windows.Forms.Label();
            this.lblTotalTimeTitle = new System.Windows.Forms.Label();
            this.statsTitle = new System.Windows.Forms.Label();
            this.buttonsPanel = new System.Windows.Forms.Panel();
            this.btnExit = new System.Windows.Forms.Button();
            this.btnEpisode = new System.Windows.Forms.Button();
            this.btnTvShow = new System.Windows.Forms.Button();
            this.btnDocumentary = new System.Windows.Forms.Button();
            this.btnMovie = new System.Windows.Forms.Button();
            this.btnSeries = new System.Windows.Forms.Button();
            this.statsPanel.SuspendLayout();
            this.buttonsPanel.SuspendLayout();
            this.SuspendLayout();
            // 
            // titleLabel
            // 
            this.titleLabel.Dock = System.Windows.Forms.DockStyle.Top;
            this.titleLabel.Font = new System.Drawing.Font("Segoe UI", 28F, System.Drawing.FontStyle.Bold);
            this.titleLabel.ForeColor = System.Drawing.Color.DarkRed;
            this.titleLabel.Location = new System.Drawing.Point(0, 0);
            this.titleLabel.Name = "titleLabel";
            this.titleLabel.Padding = new System.Windows.Forms.Padding(0, 20, 0, 0);
            this.titleLabel.Size = new System.Drawing.Size(884, 80);
            this.titleLabel.TabIndex = 0;
            this.titleLabel.Text = "🎬 Horror Tracker";
            this.titleLabel.TextAlign = System.Drawing.ContentAlignment.TopCenter;
            // 
            // descriptionLabel
            // 
            this.descriptionLabel.Dock = System.Windows.Forms.DockStyle.Top;
            this.descriptionLabel.Font = new System.Drawing.Font("Segoe UI", 11F);
            this.descriptionLabel.ForeColor = System.Drawing.Color.LightGray;
            this.descriptionLabel.Location = new System.Drawing.Point(0, 80);
            this.descriptionLabel.Name = "descriptionLabel";
            this.descriptionLabel.Padding = new System.Windows.Forms.Padding(20, 0, 20, 10);
            this.descriptionLabel.Size = new System.Drawing.Size(884, 60);
            this.descriptionLabel.TabIndex = 1;
            this.descriptionLabel.Text = "Manage your horror movie collection, track series, documentaries, TV shows, and " +
    "episodes.\r\nSelect an option below to get started.";
            this.descriptionLabel.TextAlign = System.Drawing.ContentAlignment.TopCenter;
            // 
            // statsPanel
            // 
            this.statsPanel.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(35)))), ((int)(((byte)(35)))), ((int)(((byte)(35)))));
            this.statsPanel.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.statsPanel.Controls.Add(this.lblWatched);
            this.statsPanel.Controls.Add(this.lblWatchedTitle);
            this.statsPanel.Controls.Add(this.lblTimeLeft);
            this.statsPanel.Controls.Add(this.lblTimeLeftTitle);
            this.statsPanel.Controls.Add(this.lblTotalTime);
            this.statsPanel.Controls.Add(this.lblTotalTimeTitle);
            this.statsPanel.Controls.Add(this.statsTitle);
            this.statsPanel.Location = new System.Drawing.Point(242, 160);
            this.statsPanel.Name = "statsPanel";
            this.statsPanel.Size = new System.Drawing.Size(400, 150);
            this.statsPanel.TabIndex = 2;
            // 
            // lblWatched
            // 
            this.lblWatched.Font = new System.Drawing.Font("Segoe UI", 12F, System.Drawing.FontStyle.Bold);
            this.lblWatched.ForeColor = System.Drawing.Color.LimeGreen;
            this.lblWatched.Location = new System.Drawing.Point(200, 105);
            this.lblWatched.Name = "lblWatched";
            this.lblWatched.Size = new System.Drawing.Size(180, 25);
            this.lblWatched.TabIndex = 6;
            this.lblWatched.Text = "0.00 hours";
            this.lblWatched.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
            // 
            // lblWatchedTitle
            // 
            this.lblWatchedTitle.Font = new System.Drawing.Font("Segoe UI", 10F);
            this.lblWatchedTitle.ForeColor = System.Drawing.Color.LightGray;
            this.lblWatchedTitle.Location = new System.Drawing.Point(200, 85);
            this.lblWatchedTitle.Name = "lblWatchedTitle";
            this.lblWatchedTitle.Size = new System.Drawing.Size(180, 20);
            this.lblWatchedTitle.TabIndex = 5;
            this.lblWatchedTitle.Text = "Time Watched";
            this.lblWatchedTitle.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
            // 
            // lblTimeLeft
            // 
            this.lblTimeLeft.Font = new System.Drawing.Font("Segoe UI", 12F, System.Drawing.FontStyle.Bold);
            this.lblTimeLeft.ForeColor = System.Drawing.Color.Orange;
            this.lblTimeLeft.Location = new System.Drawing.Point(200, 55);
            this.lblTimeLeft.Name = "lblTimeLeft";
            this.lblTimeLeft.Size = new System.Drawing.Size(180, 25);
            this.lblTimeLeft.TabIndex = 4;
            this.lblTimeLeft.Text = "0.00 hours";
            this.lblTimeLeft.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
            // 
            // lblTimeLeftTitle
            // 
            this.lblTimeLeftTitle.Font = new System.Drawing.Font("Segoe UI", 10F);
            this.lblTimeLeftTitle.ForeColor = System.Drawing.Color.LightGray;
            this.lblTimeLeftTitle.Location = new System.Drawing.Point(200, 35);
            this.lblTimeLeftTitle.Name = "lblTimeLeftTitle";
            this.lblTimeLeftTitle.Size = new System.Drawing.Size(180, 20);
            this.lblTimeLeftTitle.TabIndex = 3;
            this.lblTimeLeftTitle.Text = "Time Remaining";
            this.lblTimeLeftTitle.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
            // 
            // lblTotalTime
            // 
            this.lblTotalTime.Font = new System.Drawing.Font("Segoe UI", 12F, System.Drawing.FontStyle.Bold);
            this.lblTotalTime.ForeColor = System.Drawing.Color.Crimson;
            this.lblTotalTime.Location = new System.Drawing.Point(20, 55);
            this.lblTotalTime.Name = "lblTotalTime";
            this.lblTotalTime.Size = new System.Drawing.Size(180, 25);
            this.lblTotalTime.TabIndex = 2;
            this.lblTotalTime.Text = "0.00 hours";
            this.lblTotalTime.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
            // 
            // lblTotalTimeTitle
            // 
            this.lblTotalTimeTitle.Font = new System.Drawing.Font("Segoe UI", 10F);
            this.lblTotalTimeTitle.ForeColor = System.Drawing.Color.LightGray;
            this.lblTotalTimeTitle.Location = new System.Drawing.Point(20, 35);
            this.lblTotalTimeTitle.Name = "lblTotalTimeTitle";
            this.lblTotalTimeTitle.Size = new System.Drawing.Size(180, 20);
            this.lblTotalTimeTitle.TabIndex = 1;
            this.lblTotalTimeTitle.Text = "Total Content Time";
            this.lblTotalTimeTitle.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
            // 
            // statsTitle
            // 
            this.statsTitle.Dock = System.Windows.Forms.DockStyle.Top;
            this.statsTitle.Font = new System.Drawing.Font("Segoe UI", 12F, System.Drawing.FontStyle.Bold);
            this.statsTitle.ForeColor = System.Drawing.Color.White;
            this.statsTitle.Location = new System.Drawing.Point(0, 0);
            this.statsTitle.Name = "statsTitle";
            this.statsTitle.Size = new System.Drawing.Size(398, 30);
            this.statsTitle.TabIndex = 0;
            this.statsTitle.Text = "📊 Overall Statistics";
            this.statsTitle.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
            // 
            // buttonsPanel
            // 
            this.buttonsPanel.Controls.Add(this.btnExit);
            this.buttonsPanel.Controls.Add(this.btnEpisode);
            this.buttonsPanel.Controls.Add(this.btnTvShow);
            this.buttonsPanel.Controls.Add(this.btnDocumentary);
            this.buttonsPanel.Controls.Add(this.btnMovie);
            this.buttonsPanel.Controls.Add(this.btnSeries);
            this.buttonsPanel.Location = new System.Drawing.Point(192, 330);
            this.buttonsPanel.Name = "buttonsPanel";
            this.buttonsPanel.Size = new System.Drawing.Size(500, 310);
            this.buttonsPanel.TabIndex = 3;
            // 
            // btnExit
            // 
            this.btnExit.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(139)))), ((int)(((byte)(0)))), ((int)(((byte)(0)))));
            this.btnExit.FlatAppearance.BorderColor = System.Drawing.Color.Red;
            this.btnExit.FlatAppearance.BorderSize = 2;
            this.btnExit.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
            this.btnExit.Font = new System.Drawing.Font("Segoe UI", 12F, System.Drawing.FontStyle.Bold);
            this.btnExit.ForeColor = System.Drawing.Color.White;
            this.btnExit.Location = new System.Drawing.Point(150, 250);
            this.btnExit.Name = "btnExit";
            this.btnExit.Size = new System.Drawing.Size(200, 50);
            this.btnExit.TabIndex = 5;
            this.btnExit.Text = "🚪 Exit";
            this.btnExit.UseVisualStyleBackColor = false;
            this.btnExit.Click += new System.EventHandler(this.BtnExit_Click);
            // 
            // btnEpisode
            // 
            this.btnEpisode.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(50)))), ((int)(((byte)(50)))), ((int)(((byte)(50)))));
            this.btnEpisode.FlatAppearance.BorderColor = System.Drawing.Color.DarkRed;
            this.btnEpisode.FlatAppearance.BorderSize = 2;
            this.btnEpisode.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
            this.btnEpisode.Font = new System.Drawing.Font("Segoe UI", 12F, System.Drawing.FontStyle.Bold);
            this.btnEpisode.ForeColor = System.Drawing.Color.White;
            this.btnEpisode.Location = new System.Drawing.Point(260, 130);
            this.btnEpisode.Name = "btnEpisode";
            this.btnEpisode.Size = new System.Drawing.Size(220, 50);
            this.btnEpisode.TabIndex = 4;
            this.btnEpisode.Text = "📺 Episode";
            this.btnEpisode.UseVisualStyleBackColor = false;
            this.btnEpisode.Click += new System.EventHandler(this.BtnEpisode_Click);
            // 
            // btnTvShow
            // 
            this.btnTvShow.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(50)))), ((int)(((byte)(50)))), ((int)(((byte)(50)))));
            this.btnTvShow.FlatAppearance.BorderColor = System.Drawing.Color.DarkRed;
            this.btnTvShow.FlatAppearance.BorderSize = 2;
            this.btnTvShow.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
            this.btnTvShow.Font = new System.Drawing.Font("Segoe UI", 12F, System.Drawing.FontStyle.Bold);
            this.btnTvShow.ForeColor = System.Drawing.Color.White;
            this.btnTvShow.Location = new System.Drawing.Point(20, 130);
            this.btnTvShow.Name = "btnTvShow";
            this.btnTvShow.Size = new System.Drawing.Size(220, 50);
            this.btnTvShow.TabIndex = 3;
            this.btnTvShow.Text = "📡 TV Show";
            this.btnTvShow.UseVisualStyleBackColor = false;
            this.btnTvShow.Click += new System.EventHandler(this.BtnTvShow_Click);
            // 
            // btnDocumentary
            // 
            this.btnDocumentary.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(50)))), ((int)(((byte)(50)))), ((int)(((byte)(50)))));
            this.btnDocumentary.FlatAppearance.BorderColor = System.Drawing.Color.DarkRed;
            this.btnDocumentary.FlatAppearance.BorderSize = 2;
            this.btnDocumentary.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
            this.btnDocumentary.Font = new System.Drawing.Font("Segoe UI", 12F, System.Drawing.FontStyle.Bold);
            this.btnDocumentary.ForeColor = System.Drawing.Color.White;
            this.btnDocumentary.Location = new System.Drawing.Point(260, 60);
            this.btnDocumentary.Name = "btnDocumentary";
            this.btnDocumentary.Size = new System.Drawing.Size(220, 50);
            this.btnDocumentary.TabIndex = 2;
            this.btnDocumentary.Text = "🎞️ Documentary";
            this.btnDocumentary.UseVisualStyleBackColor = false;
            this.btnDocumentary.Click += new System.EventHandler(this.BtnDocumentary_Click);
            // 
            // btnMovie
            // 
            this.btnMovie.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(50)))), ((int)(((byte)(50)))), ((int)(((byte)(50)))));
            this.btnMovie.FlatAppearance.BorderColor = System.Drawing.Color.DarkRed;
            this.btnMovie.FlatAppearance.BorderSize = 2;
            this.btnMovie.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
            this.btnMovie.Font = new System.Drawing.Font("Segoe UI", 12F, System.Drawing.FontStyle.Bold);
            this.btnMovie.ForeColor = System.Drawing.Color.White;
            this.btnMovie.Location = new System.Drawing.Point(20, 60);
            this.btnMovie.Name = "btnMovie";
            this.btnMovie.Size = new System.Drawing.Size(220, 50);
            this.btnMovie.TabIndex = 1;
            this.btnMovie.Text = "🎥 Movie";
            this.btnMovie.UseVisualStyleBackColor = false;
            this.btnMovie.Click += new System.EventHandler(this.BtnMovie_Click);
            // 
            // btnSeries
            // 
            this.btnSeries.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(50)))), ((int)(((byte)(50)))), ((int)(((byte)(50)))));
            this.btnSeries.FlatAppearance.BorderColor = System.Drawing.Color.DarkRed;
            this.btnSeries.FlatAppearance.BorderSize = 2;
            this.btnSeries.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
            this.btnSeries.Font = new System.Drawing.Font("Segoe UI", 12F, System.Drawing.FontStyle.Bold);
            this.btnSeries.ForeColor = System.Drawing.Color.White;
            this.btnSeries.Location = new System.Drawing.Point(140, 0);
            this.btnSeries.Name = "btnSeries";
            this.btnSeries.Size = new System.Drawing.Size(220, 50);
            this.btnSeries.TabIndex = 0;
            this.btnSeries.Text = "🎬 Series";
            this.btnSeries.UseVisualStyleBackColor = false;
            this.btnSeries.Click += new System.EventHandler(this.BtnSeries_Click);
            // 
            // MainForm
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(7F, 15F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(45)))), ((int)(((byte)(45)))), ((int)(((byte)(45)))));
            this.ClientSize = new System.Drawing.Size(884, 661);
            this.Controls.Add(this.buttonsPanel);
            this.Controls.Add(this.statsPanel);
            this.Controls.Add(this.descriptionLabel);
            this.Controls.Add(this.titleLabel);
            this.Name = "MainForm";
            this.Text = "Horror Tracker";
            this.statsPanel.ResumeLayout(false);
            this.buttonsPanel.ResumeLayout(false);
            this.ResumeLayout(false);
        }

        #endregion

        private System.Windows.Forms.Label titleLabel;
        private System.Windows.Forms.Label descriptionLabel;
        private System.Windows.Forms.Panel statsPanel;
        private System.Windows.Forms.Label statsTitle;
        private System.Windows.Forms.Label lblTotalTime;
        private System.Windows.Forms.Label lblTotalTimeTitle;
        private System.Windows.Forms.Label lblTimeLeft;
        private System.Windows.Forms.Label lblTimeLeftTitle;
        private System.Windows.Forms.Label lblWatched;
        private System.Windows.Forms.Label lblWatchedTitle;
        private System.Windows.Forms.Panel buttonsPanel;
        private System.Windows.Forms.Button btnExit;
        private System.Windows.Forms.Button btnEpisode;
        private System.Windows.Forms.Button btnTvShow;
        private System.Windows.Forms.Button btnDocumentary;
        private System.Windows.Forms.Button btnMovie;
        private System.Windows.Forms.Button btnSeries;

        private void BtnSeries_Click(object sender, System.EventArgs e)
        {
            var seriesForm = new SeriesForm(_connectionString, _logger);
            seriesForm.ShowDialog();
        }

        private void BtnMovie_Click(object sender, System.EventArgs e)
        {
            MessageBox.Show("Movie form coming soon!", "Movie", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        private void BtnDocumentary_Click(object sender, System.EventArgs e)
        {
            MessageBox.Show("Documentary form coming soon!", "Documentary", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        private void BtnTvShow_Click(object sender, System.EventArgs e)
        {
            MessageBox.Show("TV Show form coming soon!", "TV Show", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        private void BtnEpisode_Click(object sender, System.EventArgs e)
        {
            MessageBox.Show("Episode form coming soon!", "Episode", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        private void BtnExit_Click(object sender, System.EventArgs e)
        {
            this.Close();
        }
    }
}