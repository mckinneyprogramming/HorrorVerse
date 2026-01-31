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
            this.buttonsPanel = new System.Windows.Forms.Panel();
            this.btnBack = new System.Windows.Forms.Button();
            this.btnUpdateSeries = new System.Windows.Forms.Button();
            this.btnViewSeries = new System.Windows.Forms.Button();
            this.btnAddSeries = new System.Windows.Forms.Button();
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
            this.descriptionLabel.Size = new System.Drawing.Size(884, 60);
            this.descriptionLabel.TabIndex = 1;
            this.descriptionLabel.Text = "Manage your horror movie series collection.\r\nAdd new series, view existing ones," +
    " or update series information.";
            this.descriptionLabel.TextAlign = System.Drawing.ContentAlignment.TopCenter;
            // 
            // buttonsPanel
            // 
            this.buttonsPanel.Controls.Add(this.btnBack);
            this.buttonsPanel.Controls.Add(this.btnUpdateSeries);
            this.buttonsPanel.Controls.Add(this.btnViewSeries);
            this.buttonsPanel.Controls.Add(this.btnAddSeries);
            this.buttonsPanel.Location = new System.Drawing.Point(242, 200);
            this.buttonsPanel.Name = "buttonsPanel";
            this.buttonsPanel.Size = new System.Drawing.Size(400, 350);
            this.buttonsPanel.TabIndex = 2;
            // 
            // btnBack
            // 
            this.btnBack.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(70)))), ((int)(((byte)(70)))), ((int)(((byte)(70)))));
            this.btnBack.FlatAppearance.BorderColor = System.Drawing.Color.Gray;
            this.btnBack.FlatAppearance.BorderSize = 2;
            this.btnBack.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
            this.btnBack.Font = new System.Drawing.Font("Segoe UI", 12F, System.Drawing.FontStyle.Bold);
            this.btnBack.ForeColor = System.Drawing.Color.White;
            this.btnBack.Location = new System.Drawing.Point(100, 280);
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
            this.ClientSize = new System.Drawing.Size(884, 661);
            this.Controls.Add(this.buttonsPanel);
            this.Controls.Add(this.descriptionLabel);
            this.Controls.Add(this.titleLabel);
            this.Name = "SeriesForm";
            this.Text = "Series Management";
            this.buttonsPanel.ResumeLayout(false);
            this.ResumeLayout(false);
        }

        #endregion

        private System.Windows.Forms.Label titleLabel;
        private System.Windows.Forms.Label descriptionLabel;
        private System.Windows.Forms.Panel buttonsPanel;
        private System.Windows.Forms.Button btnAddSeries;
        private System.Windows.Forms.Button btnViewSeries;
        private System.Windows.Forms.Button btnUpdateSeries;
        private System.Windows.Forms.Button btnBack;
    }
}