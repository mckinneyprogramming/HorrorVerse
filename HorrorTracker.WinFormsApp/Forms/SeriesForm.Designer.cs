namespace HorrorTracker.WinFormsApp.Forms
{
    partial class SeriesForm
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
            this.searchPanel = new System.Windows.Forms.Panel();
            this.txtDescription = new System.Windows.Forms.TextBox();
            this.lblDescription = new System.Windows.Forms.Label();
            this.btnAddSelected = new System.Windows.Forms.Button();
            this.lstSearchResults = new System.Windows.Forms.ListBox();
            this.lblSearchResults = new System.Windows.Forms.Label();
            this.btnSearch = new System.Windows.Forms.Button();
            this.txtSearch = new System.Windows.Forms.TextBox();
            this.lblSearch = new System.Windows.Forms.Label();
            this.searchTitle = new System.Windows.Forms.Label();
            this.buttonsPanel = new System.Windows.Forms.Panel();
            this.btnBack = new System.Windows.Forms.Button();
            this.btnUpdateSeries = new System.Windows.Forms.Button();
            this.btnViewSeries = new System.Windows.Forms.Button();
            this.btnAddSeries = new System.Windows.Forms.Button();
            this.searchPanel.SuspendLayout();
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
            this.titleLabel.Text = "🎬 Series Management";
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
            this.descriptionLabel.Text = "Search for series on TMDb, manage existing series, or update series information." +
    "";
            this.descriptionLabel.TextAlign = System.Drawing.ContentAlignment.TopCenter;
            // 
            // searchPanel
            // 
            this.searchPanel.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(35)))), ((int)(((byte)(35)))), ((int)(((byte)(35)))));
            this.searchPanel.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.searchPanel.Controls.Add(this.txtDescription);
            this.searchPanel.Controls.Add(this.lblDescription);
            this.searchPanel.Controls.Add(this.btnAddSelected);
            this.searchPanel.Controls.Add(this.lstSearchResults);
            this.searchPanel.Controls.Add(this.lblSearchResults);
            this.searchPanel.Controls.Add(this.btnSearch);
            this.searchPanel.Controls.Add(this.txtSearch);
            this.searchPanel.Controls.Add(this.lblSearch);
            this.searchPanel.Controls.Add(this.searchTitle);
            this.searchPanel.Location = new System.Drawing.Point(50, 160);
            this.searchPanel.Name = "searchPanel";
            this.searchPanel.Size = new System.Drawing.Size(450, 540);
            this.searchPanel.TabIndex = 2;
            // 
            // txtDescription
            // 
            this.txtDescription.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(50)))), ((int)(((byte)(50)))), ((int)(((byte)(50)))));
            this.txtDescription.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.txtDescription.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.txtDescription.ForeColor = System.Drawing.Color.LightGray;
            this.txtDescription.Location = new System.Drawing.Point(20, 410);
            this.txtDescription.Multiline = true;
            this.txtDescription.Name = "txtDescription";
            this.txtDescription.ReadOnly = true;
            this.txtDescription.ScrollBars = System.Windows.Forms.ScrollBars.Vertical;
            this.txtDescription.Size = new System.Drawing.Size(410, 75);
            this.txtDescription.TabIndex = 8;
            this.txtDescription.Text = "Select a series to view its description.";
            // 
            // lblDescription
            // 
            this.lblDescription.Font = new System.Drawing.Font("Segoe UI", 10F, System.Drawing.FontStyle.Bold);
            this.lblDescription.ForeColor = System.Drawing.Color.LightGray;
            this.lblDescription.Location = new System.Drawing.Point(20, 385);
            this.lblDescription.Name = "lblDescription";
            this.lblDescription.Size = new System.Drawing.Size(200, 20);
            this.lblDescription.TabIndex = 7;
            this.lblDescription.Text = "Description:";
            // 
            // btnAddSelected
            // 
            this.btnAddSelected.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(0)))), ((int)(((byte)(100)))), ((int)(((byte)(0)))));
            this.btnAddSelected.FlatAppearance.BorderColor = System.Drawing.Color.LimeGreen;
            this.btnAddSelected.FlatAppearance.BorderSize = 2;
            this.btnAddSelected.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
            this.btnAddSelected.Font = new System.Drawing.Font("Segoe UI", 11F, System.Drawing.FontStyle.Bold);
            this.btnAddSelected.ForeColor = System.Drawing.Color.White;
            this.btnAddSelected.Location = new System.Drawing.Point(100, 495);
            this.btnAddSelected.Name = "btnAddSelected";
            this.btnAddSelected.Size = new System.Drawing.Size(250, 35);
            this.btnAddSelected.TabIndex = 6;
            this.btnAddSelected.Text = "➕ Add Selected Series";
            this.btnAddSelected.UseVisualStyleBackColor = false;
            this.btnAddSelected.Click += new System.EventHandler(this.BtnAddSelected_Click);
            // 
            // lstSearchResults
            // 
            this.lstSearchResults.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(50)))), ((int)(((byte)(50)))), ((int)(((byte)(50)))));

            this.lstSearchResults.ForeColor = System.Drawing.Color.White;
            this.lstSearchResults.FormattingEnabled = true;
            this.lstSearchResults.ItemHeight = 15;
            this.lstSearchResults.Location = new System.Drawing.Point(20, 165);
            this.lstSearchResults.Name = "lstSearchResults";
            this.lstSearchResults.Size = new System.Drawing.Size(410, 214);
            this.lstSearchResults.TabIndex = 5;
            this.lstSearchResults.SelectedIndexChanged += new System.EventHandler(this.LstSearchResults_SelectedIndexChanged);
            // 
            // lblSearchResults
            // 
            this.lblSearchResults.Font = new System.Drawing.Font("Segoe UI", 10F, System.Drawing.FontStyle.Bold);
            this.lblSearchResults.ForeColor = System.Drawing.Color.LightGray;
            this.lblSearchResults.Location = new System.Drawing.Point(20, 140);
            this.lblSearchResults.Name = "lblSearchResults";
            this.lblSearchResults.Size = new System.Drawing.Size(200, 20);
            this.lblSearchResults.TabIndex = 4;
            this.lblSearchResults.Text = "Search Results:";
            // 
            // btnSearch
            // 
            this.btnSearch.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(50)))), ((int)(((byte)(50)))), ((int)(((byte)(50)))));
            this.btnSearch.FlatAppearance.BorderColor = System.Drawing.Color.DarkRed;
            this.btnSearch.FlatAppearance.BorderSize = 2;
            this.btnSearch.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
            this.btnSearch.Font = new System.Drawing.Font("Segoe UI", 10F, System.Drawing.FontStyle.Bold);
            this.btnSearch.ForeColor = System.Drawing.Color.White;
            this.btnSearch.Location = new System.Drawing.Point(310, 95);
            this.btnSearch.Name = "btnSearch";
            this.btnSearch.Size = new System.Drawing.Size(120, 35);
            this.btnSearch.TabIndex = 3;
            this.btnSearch.Text = "🔍 Search";
            this.btnSearch.UseVisualStyleBackColor = false;
            this.btnSearch.Click += new System.EventHandler(this.BtnSearch_Click);
            // 
            // txtSearch
            // 
            this.txtSearch.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(50)))), ((int)(((byte)(50)))), ((int)(((byte)(50)))));
            this.txtSearch.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.txtSearch.Font = new System.Drawing.Font("Segoe UI", 12F);
            this.txtSearch.ForeColor = System.Drawing.Color.White;
            this.txtSearch.Location = new System.Drawing.Point(20, 95);
            this.txtSearch.Name = "txtSearch";
            this.txtSearch.Size = new System.Drawing.Size(270, 29);
            this.txtSearch.TabIndex = 2;
            // 
            // lblSearch
            // 
            this.lblSearch.Font = new System.Drawing.Font("Segoe UI", 10F);
            this.lblSearch.ForeColor = System.Drawing.Color.LightGray;
            this.lblSearch.Location = new System.Drawing.Point(20, 40);
            this.lblSearch.Name = "lblSearch";
            this.lblSearch.Size = new System.Drawing.Size(410, 50);
            this.lblSearch.TabIndex = 1;
            this.lblSearch.Text = "Search for movie series collections on The Movie Database (TMDb). Enter any part " +
    "of the series name:";
            // 
            // searchTitle
            // 
            this.searchTitle.Dock = System.Windows.Forms.DockStyle.Top;
            this.searchTitle.Font = new System.Drawing.Font("Segoe UI", 12F, System.Drawing.FontStyle.Bold);
            this.searchTitle.ForeColor = System.Drawing.Color.White;
            this.searchTitle.Location = new System.Drawing.Point(0, 0);
            this.searchTitle.Name = "searchTitle";
            this.searchTitle.Size = new System.Drawing.Size(448, 30);
            this.searchTitle.TabIndex = 0;
            this.searchTitle.Text = "🔎 Search TMDb";
            this.searchTitle.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
            // 
            // buttonsPanel
            // 
            this.buttonsPanel.Controls.Add(this.btnBack);
            this.buttonsPanel.Controls.Add(this.btnUpdateSeries);
            this.buttonsPanel.Controls.Add(this.btnViewSeries);
            this.buttonsPanel.Controls.Add(this.btnAddSeries);
            this.buttonsPanel.Location = new System.Drawing.Point(534, 160);
            this.buttonsPanel.Name = "buttonsPanel";
            this.buttonsPanel.Size = new System.Drawing.Size(400, 450);
            this.buttonsPanel.TabIndex = 3;
            // 
            // btnBack
            // 
            this.btnBack.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(70)))), ((int)(((byte)(70)))), ((int)(((byte)(70)))));
            this.btnBack.FlatAppearance.BorderColor = System.Drawing.Color.Gray;
            this.btnBack.FlatAppearance.BorderSize = 2;
            this.btnBack.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
            this.btnBack.Font = new System.Drawing.Font("Segoe UI", 12F, System.Drawing.FontStyle.Bold);
            this.btnBack.ForeColor = System.Drawing.Color.White;
            this.btnBack.Location = new System.Drawing.Point(100, 385);
            this.btnBack.Name = "btnBack";
            this.btnBack.Size = new System.Drawing.Size(200, 50);
            this.btnBack.TabIndex = 3;
            this.btnBack.Text = "⬅️ Back";
            this.btnBack.UseVisualStyleBackColor = false;
            this.btnBack.Click += new System.EventHandler(this.BtnBack_Click);
            // 
            // btnUpdateSeries
            // 
            this.btnUpdateSeries.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(50)))), ((int)(((byte)(50)))), ((int)(((byte)(50)))));
            this.btnUpdateSeries.FlatAppearance.BorderColor = System.Drawing.Color.DarkRed;
            this.btnUpdateSeries.FlatAppearance.BorderSize = 2;
            this.btnUpdateSeries.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
            this.btnUpdateSeries.Font = new System.Drawing.Font("Segoe UI", 14F, System.Drawing.FontStyle.Bold);
            this.btnUpdateSeries.ForeColor = System.Drawing.Color.White;
            this.btnUpdateSeries.Location = new System.Drawing.Point(50, 190);
            this.btnUpdateSeries.Name = "btnUpdateSeries";
            this.btnUpdateSeries.Size = new System.Drawing.Size(300, 60);
            this.btnUpdateSeries.TabIndex = 2;
            this.btnUpdateSeries.Text = "✏️ Update Series";
            this.btnUpdateSeries.UseVisualStyleBackColor = false;
            this.btnUpdateSeries.Click += new System.EventHandler(this.BtnUpdateSeries_Click);
            // 
            // btnViewSeries
            // 
            this.btnViewSeries.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(50)))), ((int)(((byte)(50)))), ((int)(((byte)(50)))));
            this.btnViewSeries.FlatAppearance.BorderColor = System.Drawing.Color.DarkRed;
            this.btnViewSeries.FlatAppearance.BorderSize = 2;
            this.btnViewSeries.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
            this.btnViewSeries.Font = new System.Drawing.Font("Segoe UI", 14F, System.Drawing.FontStyle.Bold);
            this.btnViewSeries.ForeColor = System.Drawing.Color.White;
            this.btnViewSeries.Location = new System.Drawing.Point(50, 100);
            this.btnViewSeries.Name = "btnViewSeries";
            this.btnViewSeries.Size = new System.Drawing.Size(300, 60);
            this.btnViewSeries.TabIndex = 1;
            this.btnViewSeries.Text = "👁️ View Series";
            this.btnViewSeries.UseVisualStyleBackColor = false;
            this.btnViewSeries.Click += new System.EventHandler(this.BtnViewSeries_Click);
            // 
            // btnAddSeries
            // 
            this.btnAddSeries.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(50)))), ((int)(((byte)(50)))), ((int)(((byte)(50)))));
            this.btnAddSeries.FlatAppearance.BorderColor = System.Drawing.Color.DarkRed;
            this.btnAddSeries.FlatAppearance.BorderSize = 2;
            this.btnAddSeries.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
            this.btnAddSeries.Font = new System.Drawing.Font("Segoe UI", 14F, System.Drawing.FontStyle.Bold);
            this.btnAddSeries.ForeColor = System.Drawing.Color.White;
            this.btnAddSeries.Location = new System.Drawing.Point(50, 10);
            this.btnAddSeries.Name = "btnAddSeries";
            this.btnAddSeries.Size = new System.Drawing.Size(300, 60);
            this.btnAddSeries.TabIndex = 0;
            this.btnAddSeries.Text = "➕ Add New Series";
            this.btnAddSeries.UseVisualStyleBackColor = false;
            this.btnAddSeries.Click += new System.EventHandler(this.BtnAddSeries_Click);
            // 
            // SeriesForm
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(7F, 15F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(45)))), ((int)(((byte)(45)))), ((int)(((byte)(45)))));
            this.ClientSize = new System.Drawing.Size(984, 711);
            this.Controls.Add(this.buttonsPanel);
            this.Controls.Add(this.searchPanel);
            this.Controls.Add(this.descriptionLabel);
            this.Controls.Add(this.titleLabel);
            this.Name = "SeriesForm";
            this.Text = "Series Management";
            this.searchPanel.ResumeLayout(false);
            this.searchPanel.PerformLayout();
            this.buttonsPanel.ResumeLayout(false);
            this.ResumeLayout(false);
        }

        #endregion

        private System.Windows.Forms.Label titleLabel;
        private System.Windows.Forms.Label descriptionLabel;
        private System.Windows.Forms.Panel searchPanel;
        private System.Windows.Forms.Label searchTitle;
        private System.Windows.Forms.Label lblSearch;
        private System.Windows.Forms.TextBox txtSearch;
        private System.Windows.Forms.Button btnSearch;
        private System.Windows.Forms.ListBox lstSearchResults;
        private System.Windows.Forms.Label lblSearchResults;
        private System.Windows.Forms.Button btnAddSelected;
        private System.Windows.Forms.TextBox txtDescription;
        private System.Windows.Forms.Label lblDescription;
        private System.Windows.Forms.Panel buttonsPanel;
        private System.Windows.Forms.Button btnAddSeries;
        private System.Windows.Forms.Button btnViewSeries;
        private System.Windows.Forms.Button btnUpdateSeries;
        private System.Windows.Forms.Button btnBack;
    }
}