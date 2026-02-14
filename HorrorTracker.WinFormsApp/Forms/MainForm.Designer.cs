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
            this.lblWatchedShows = new System.Windows.Forms.Label();
            this.lblWatchedDocumentaries = new System.Windows.Forms.Label();
            this.lblWatchedMovies = new System.Windows.Forms.Label();
            this.lblWatchedSeries = new System.Windows.Forms.Label();
            this.lblTotalShows = new System.Windows.Forms.Label();
            this.lblTotalDocumentaries = new System.Windows.Forms.Label();
            this.lblTotalMovies = new System.Windows.Forms.Label();
            this.lblTotalSeries = new System.Windows.Forms.Label();
            this.lblWatched = new System.Windows.Forms.Label();
            this.lblWatchedTitle = new System.Windows.Forms.Label();
            this.lblTimeLeft = new System.Windows.Forms.Label();
            this.lblTimeLeftTitle = new System.Windows.Forms.Label();
            this.lblTotalTime = new System.Windows.Forms.Label();
            this.lblTotalTimeTitle = new System.Windows.Forms.Label();
            this.statsTitle = new System.Windows.Forms.Label();
            this.countsPanel = new System.Windows.Forms.Panel();
            this.countsTitle = new System.Windows.Forms.Label();
            this.lblShowsTitle = new System.Windows.Forms.Label();
            this.lblDocumentariesTitle = new System.Windows.Forms.Label();
            this.lblMoviesTitle = new System.Windows.Forms.Label();
            this.lblSeriesTitle = new System.Windows.Forms.Label();
            this.label1 = new System.Windows.Forms.Label();
            this.label2 = new System.Windows.Forms.Label();
            this.buttonsPanel = new System.Windows.Forms.Panel();
            this.btnExit = new System.Windows.Forms.Button();
            this.btnEpisode = new System.Windows.Forms.Button();
            this.btnTvShow = new System.Windows.Forms.Button();
            this.btnDocumentary = new System.Windows.Forms.Button();
            this.btnMovie = new System.Windows.Forms.Button();
            this.btnSeries = new System.Windows.Forms.Button();
            this.statsPanel.SuspendLayout();
            this.countsPanel.SuspendLayout();
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
            this.titleLabel.Size = new System.Drawing.Size(984, 80);
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
            this.descriptionLabel.Size = new System.Drawing.Size(984, 60);
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
            this.statsPanel.Location = new System.Drawing.Point(50, 160);
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
            this.statsTitle.Text = "⏱️ Time Statistics";
            this.statsTitle.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
            // 
            // countsPanel
            // 
            this.countsPanel.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(35)))), ((int)(((byte)(35)))), ((int)(((byte)(35)))));
            this.countsPanel.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.countsPanel.Controls.Add(this.lblWatchedShows);
            this.countsPanel.Controls.Add(this.lblWatchedDocumentaries);
            this.countsPanel.Controls.Add(this.lblWatchedMovies);
            this.countsPanel.Controls.Add(this.lblWatchedSeries);
            this.countsPanel.Controls.Add(this.lblTotalShows);
            this.countsPanel.Controls.Add(this.lblTotalDocumentaries);
            this.countsPanel.Controls.Add(this.lblTotalMovies);
            this.countsPanel.Controls.Add(this.lblTotalSeries);
            this.countsPanel.Controls.Add(this.label2);
            this.countsPanel.Controls.Add(this.label1);
            this.countsPanel.Controls.Add(this.lblShowsTitle);
            this.countsPanel.Controls.Add(this.lblDocumentariesTitle);
            this.countsPanel.Controls.Add(this.lblMoviesTitle);
            this.countsPanel.Controls.Add(this.lblSeriesTitle);
            this.countsPanel.Controls.Add(this.countsTitle);
            this.countsPanel.Location = new System.Drawing.Point(534, 160);
            this.countsPanel.Name = "countsPanel";
            this.countsPanel.Size = new System.Drawing.Size(400, 220);
            this.countsPanel.TabIndex = 3;
            // 
            // countsTitle
            // 
            this.countsTitle.Dock = System.Windows.Forms.DockStyle.Top;
            this.countsTitle.Font = new System.Drawing.Font("Segoe UI", 12F, System.Drawing.FontStyle.Bold);
            this.countsTitle.ForeColor = System.Drawing.Color.White;
            this.countsTitle.Location = new System.Drawing.Point(0, 0);
            this.countsTitle.Name = "countsTitle";
            this.countsTitle.Size = new System.Drawing.Size(398, 30);
            this.countsTitle.TabIndex = 0;
            this.countsTitle.Text = "📊 Content Statistics";
            this.countsTitle.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
            // 
            // lblShowsTitle
            // 
            this.lblShowsTitle.Font = new System.Drawing.Font("Segoe UI", 10F);
            this.lblShowsTitle.ForeColor = System.Drawing.Color.LightGray;
            this.lblShowsTitle.Location = new System.Drawing.Point(20, 170);
            this.lblShowsTitle.Name = "lblShowsTitle";
            this.lblShowsTitle.Size = new System.Drawing.Size(120, 25);
            this.lblShowsTitle.TabIndex = 7;
            this.lblShowsTitle.Text = "📡 TV Shows:";
            this.lblShowsTitle.TextAlign = System.Drawing.ContentAlignment.MiddleLeft;
            // 
            // lblDocumentariesTitle
            // 
            this.lblDocumentariesTitle.Font = new System.Drawing.Font("Segoe UI", 10F);
            this.lblDocumentariesTitle.ForeColor = System.Drawing.Color.LightGray;
            this.lblDocumentariesTitle.Location = new System.Drawing.Point(20, 135);
            this.lblDocumentariesTitle.Name = "lblDocumentariesTitle";
            this.lblDocumentariesTitle.Size = new System.Drawing.Size(130, 25);
            this.lblDocumentariesTitle.TabIndex = 5;
            this.lblDocumentariesTitle.Text = "🎞️ Documentaries:";
            this.lblDocumentariesTitle.TextAlign = System.Drawing.ContentAlignment.MiddleLeft;
            // 
            // lblMoviesTitle
            // 
            this.lblMoviesTitle.Font = new System.Drawing.Font("Segoe UI", 10F);
            this.lblMoviesTitle.ForeColor = System.Drawing.Color.LightGray;
            this.lblMoviesTitle.Location = new System.Drawing.Point(20, 100);
            this.lblMoviesTitle.Name = "lblMoviesTitle";
            this.lblMoviesTitle.Size = new System.Drawing.Size(120, 25);
            this.lblMoviesTitle.TabIndex = 3;
            this.lblMoviesTitle.Text = "🎥 Movies:";
            this.lblMoviesTitle.TextAlign = System.Drawing.ContentAlignment.MiddleLeft;
            // 
            // lblSeriesTitle
            // 
            this.lblSeriesTitle.Font = new System.Drawing.Font("Segoe UI", 10F);
            this.lblSeriesTitle.ForeColor = System.Drawing.Color.LightGray;
            this.lblSeriesTitle.Location = new System.Drawing.Point(20, 65);
            this.lblSeriesTitle.Name = "lblSeriesTitle";
            this.lblSeriesTitle.Size = new System.Drawing.Size(120, 25);
            this.lblSeriesTitle.TabIndex = 1;
            this.lblSeriesTitle.Text = "🎬 Series:";
            this.lblSeriesTitle.TextAlign = System.Drawing.ContentAlignment.MiddleLeft;
            // 
            // label1
            // 
            this.label1.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Bold);
            this.label1.ForeColor = System.Drawing.Color.Silver;
            this.label1.Location = new System.Drawing.Point(150, 40);
            this.label1.Name = "label1";
            this.label1.Size = new System.Drawing.Size(100, 20);
            this.label1.TabIndex = 8;
            this.label1.Text = "Total";
            this.label1.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
            // 
            // label2
            // 
            this.label2.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Bold);
            this.label2.ForeColor = System.Drawing.Color.Silver;
            this.label2.Location = new System.Drawing.Point(270, 40);
            this.label2.Name = "label2";
            this.label2.Size = new System.Drawing.Size(100, 20);
            this.label2.TabIndex = 9;
            this.label2.Text = "Watched";
            this.label2.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
            // 
            // lblTotalSeries
            // 
            this.lblTotalSeries.Font = new System.Drawing.Font("Segoe UI", 11F, System.Drawing.FontStyle.Bold);
            this.lblTotalSeries.ForeColor = System.Drawing.Color.Cyan;
            this.lblTotalSeries.Location = new System.Drawing.Point(150, 65);
            this.lblTotalSeries.Name = "lblTotalSeries";
            this.lblTotalSeries.Size = new System.Drawing.Size(100, 25);
            this.lblTotalSeries.TabIndex = 10;
            this.lblTotalSeries.Text = "0";
            this.lblTotalSeries.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
            // 
            // lblTotalMovies
            // 
            this.lblTotalMovies.Font = new System.Drawing.Font("Segoe UI", 11F, System.Drawing.FontStyle.Bold);
            this.lblTotalMovies.ForeColor = System.Drawing.Color.Cyan;
            this.lblTotalMovies.Location = new System.Drawing.Point(150, 100);
            this.lblTotalMovies.Name = "lblTotalMovies";
            this.lblTotalMovies.Size = new System.Drawing.Size(100, 25);
            this.lblTotalMovies.TabIndex = 11;
            this.lblTotalMovies.Text = "0";
            this.lblTotalMovies.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
            // 
            // lblTotalDocumentaries
            // 
            this.lblTotalDocumentaries.Font = new System.Drawing.Font("Segoe UI", 11F, System.Drawing.FontStyle.Bold);
            this.lblTotalDocumentaries.ForeColor = System.Drawing.Color.Cyan;
            this.lblTotalDocumentaries.Location = new System.Drawing.Point(150, 135);
            this.lblTotalDocumentaries.Name = "lblTotalDocumentaries";
            this.lblTotalDocumentaries.Size = new System.Drawing.Size(100, 25);
            this.lblTotalDocumentaries.TabIndex = 12;
            this.lblTotalDocumentaries.Text = "0";
            this.lblTotalDocumentaries.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
            // 
            // lblTotalShows
            // 
            this.lblTotalShows.Font = new System.Drawing.Font("Segoe UI", 11F, System.Drawing.FontStyle.Bold);
            this.lblTotalShows.ForeColor = System.Drawing.Color.Cyan;
            this.lblTotalShows.Location = new System.Drawing.Point(150, 170);
            this.lblTotalShows.Name = "lblTotalShows";
            this.lblTotalShows.Size = new System.Drawing.Size(100, 25);
            this.lblTotalShows.TabIndex = 13;
            this.lblTotalShows.Text = "0";
            this.lblTotalShows.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
            // 
            // lblWatchedSeries
            // 
            this.lblWatchedSeries.Font = new System.Drawing.Font("Segoe UI", 11F, System.Drawing.FontStyle.Bold);
            this.lblWatchedSeries.ForeColor = System.Drawing.Color.LimeGreen;
            this.lblWatchedSeries.Location = new System.Drawing.Point(270, 65);
            this.lblWatchedSeries.Name = "lblWatchedSeries";
            this.lblWatchedSeries.Size = new System.Drawing.Size(100, 25);
            this.lblWatchedSeries.TabIndex = 14;
            this.lblWatchedSeries.Text = "0";
            this.lblWatchedSeries.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
            // 
            // lblWatchedMovies
            // 
            this.lblWatchedMovies.Font = new System.Drawing.Font("Segoe UI", 11F, System.Drawing.FontStyle.Bold);
            this.lblWatchedMovies.ForeColor = System.Drawing.Color.LimeGreen;
            this.lblWatchedMovies.Location = new System.Drawing.Point(270, 100);
            this.lblWatchedMovies.Name = "lblWatchedMovies";
            this.lblWatchedMovies.Size = new System.Drawing.Size(100, 25);
            this.lblWatchedMovies.TabIndex = 15;
            this.lblWatchedMovies.Text = "0";
            this.lblWatchedMovies.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
            // 
            // lblWatchedDocumentaries
            // 
            this.lblWatchedDocumentaries.Font = new System.Drawing.Font("Segoe UI", 11F, System.Drawing.FontStyle.Bold);
            this.lblWatchedDocumentaries.ForeColor = System.Drawing.Color.LimeGreen;
            this.lblWatchedDocumentaries.Location = new System.Drawing.Point(270, 135);
            this.lblWatchedDocumentaries.Name = "lblWatchedDocumentaries";
            this.lblWatchedDocumentaries.Size = new System.Drawing.Size(100, 25);
            this.lblWatchedDocumentaries.TabIndex = 16;
            this.lblWatchedDocumentaries.Text = "0";
            this.lblWatchedDocumentaries.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
            // 
            // lblWatchedShows
            // 
            this.lblWatchedShows.Font = new System.Drawing.Font("Segoe UI", 11F, System.Drawing.FontStyle.Bold);
            this.lblWatchedShows.ForeColor = System.Drawing.Color.LimeGreen;
            this.lblWatchedShows.Location = new System.Drawing.Point(270, 170);
            this.lblWatchedShows.Name = "lblWatchedShows";
            this.lblWatchedShows.Size = new System.Drawing.Size(100, 25);
            this.lblWatchedShows.TabIndex = 17;
            this.lblWatchedShows.Text = "0";
            this.lblWatchedShows.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
            // 
            // buttonsPanel
            // 
            this.buttonsPanel.Controls.Add(this.btnExit);
            this.buttonsPanel.Controls.Add(this.btnEpisode);
            this.buttonsPanel.Controls.Add(this.btnTvShow);
            this.buttonsPanel.Controls.Add(this.btnDocumentary);
            this.buttonsPanel.Controls.Add(this.btnMovie);
            this.buttonsPanel.Controls.Add(this.btnSeries);
            this.buttonsPanel.Location = new System.Drawing.Point(242, 410);
            this.buttonsPanel.Name = "buttonsPanel";
            this.buttonsPanel.Size = new System.Drawing.Size(500, 310);
            this.buttonsPanel.TabIndex = 4;
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
            this.ClientSize = new System.Drawing.Size(984, 761);
            this.Controls.Add(this.buttonsPanel);
            this.Controls.Add(this.countsPanel);
            this.Controls.Add(this.statsPanel);
            this.Controls.Add(this.descriptionLabel);
            this.Controls.Add(this.titleLabel);
            this.Name = "MainForm";
            this.Text = "Horror Tracker";
            this.statsPanel.ResumeLayout(false);
            this.countsPanel.ResumeLayout(false);
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
        private System.Windows.Forms.Panel countsPanel;
        private System.Windows.Forms.Label countsTitle;
        private System.Windows.Forms.Label lblSeriesTitle;
        private System.Windows.Forms.Label lblMoviesTitle;
        private System.Windows.Forms.Label lblDocumentariesTitle;
        private System.Windows.Forms.Label lblShowsTitle;
        private System.Windows.Forms.Label label1;
        private System.Windows.Forms.Label label2;
        private System.Windows.Forms.Label lblTotalSeries;
        private System.Windows.Forms.Label lblTotalMovies;
        private System.Windows.Forms.Label lblTotalDocumentaries;
        private System.Windows.Forms.Label lblTotalShows;
        private System.Windows.Forms.Label lblWatchedSeries;
        private System.Windows.Forms.Label lblWatchedMovies;
        private System.Windows.Forms.Label lblWatchedDocumentaries;
        private System.Windows.Forms.Label lblWatchedShows;
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